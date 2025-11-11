import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

// Helper function to call Edge Functions
async function callSupabaseFunction(functionName: string, body: any) {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

export function useCredits() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's credit wallet
  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["credit_wallet", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_wallets")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      
      // If no wallet exists, return a default wallet structure
      if (!data) {
        return {
          id: null,
          user_id: user!.id,
          balance: 0,
          total_earned: 0,
          total_spent: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      
      return data;
    },
  });

  // Fetch credit packages
  const { data: packages, isLoading: packagesLoading } = useQuery({
    queryKey: ["credit_packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_packages")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Fetch credit transactions with pagination
  const PAGE_SIZE = 20;
  const {
    data: transactionsData,
    isLoading: transactionsLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["credit_transactions", user?.id],
    enabled: !!user?.id,
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error, count } = await supabase
        .from("credit_transactions")
        .select("*", { count: 'exact' })
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      return { data: data || [], count: count || 0, page: pageParam };
    },
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, p) => sum + p.data.length, 0);
      if (totalFetched < lastPage.count) {
        return allPages.length;
      }
      return undefined;
    },
    initialPageParam: 0,
  });

  // Flatten paginated data
  const transactions = transactionsData?.pages.flatMap(p => p.data) || [];
  const totalTransactions = transactionsData?.pages[0]?.count || 0;

  // Purchase credits mutation
  const purchaseCredits = useMutation({
    mutationFn: async (packageId: string) => {
      return callSupabaseFunction("purchase-credits", { package_id: packageId });
    },
    onSuccess: (data) => {
      // Show user feedback before redirecting
      toast.info("Redirecting to payment...");
      // Small delay to ensure toast is visible before redirect
      setTimeout(() => {
        window.location.href = data.checkout_url;
      }, 500);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to initiate credit purchase");
    },
  });

  // Enroll in course with credits
  const enrollWithCredits = useMutation({
    mutationFn: async (courseId: string) => {
      return callSupabaseFunction("enroll-with-credits", { course_id: courseId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit_wallet", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["credit_transactions", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["published-courses"] });
      queryClient.invalidateQueries({ queryKey: ["my-enrollments", user?.id] });
      toast.success("Enrolled successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to enroll in course");
    },
  });

  // Request withdrawal (now does immediate payout)
  const requestWithdrawal = useMutation({
    mutationFn: async (params: {
      credits_amount: number;
      payment_method: string;
      payment_details: any;
      notes?: string;
    }) => {
      return callSupabaseFunction("immediate-withdrawal", params);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["credit_wallet", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["credit_transactions", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["withdrawal_requests", user?.id] });
      
      // Handle different success scenarios
      if (data.pending) {
        toast.info(
          "Withdrawal is being processed. You'll receive confirmation shortly.",
          { duration: 5000 }
        );
      } else {
        toast.success(
          `Withdrawal successful! MWK ${data.amount_mwk?.toLocaleString()} sent to your mobile money. New balance: ${data.new_balance} credits`,
          { duration: 6000 }
        );
      }
    },
    onError: (error: any) => {
      // Parse error message for better user feedback
      const errorMsg = error.message || "Failed to submit withdrawal request";
      
      // Check if it's a refund scenario
      if (errorMsg.includes("automatically refunded")) {
        toast.error(errorMsg, { duration: 8000 });
      } else if (errorMsg.includes("Reference:")) {
        // Critical error with reference ID
        toast.error(errorMsg, { duration: 10000 });
      } else {
        toast.error(errorMsg, { duration: 5000 });
      }
    },
  });

  // Fetch withdrawal requests (for coaches)
  const { data: withdrawalRequests, isLoading: withdrawalsLoading } = useQuery({
    queryKey: ["withdrawal_requests", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("coach_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Track ongoing retries to prevent concurrent attempts
  const ongoingRetries = new Set<string>();

  // Retry failed withdrawal
  const retryWithdrawal = useMutation({
    mutationFn: async (withdrawalRequestId: string) => {
      // Prevent concurrent retry attempts on same withdrawal
      if (ongoingRetries.has(withdrawalRequestId)) {
        throw new Error("Retry already in progress for this withdrawal. Please wait.");
      }

      ongoingRetries.add(withdrawalRequestId);

      try {
        // Get the original withdrawal request details
        const { data: originalRequest, error: fetchError } = await supabase
          .from("withdrawal_requests")
          .select("*")
          .eq("id", withdrawalRequestId)
          .single();

        if (fetchError || !originalRequest) {
          throw new Error("Failed to fetch original withdrawal request");
        }

        // Validate payment details haven't changed
        if (!originalRequest.payment_details) {
          throw new Error("Invalid withdrawal request: missing payment details");
        }

        // Check retry limit (max 3 retries)
        const retryCount = originalRequest.retry_count || 0;
        const MAX_RETRIES = 3;
        
        if (retryCount >= MAX_RETRIES) {
          throw new Error(
            `Maximum retry limit (${MAX_RETRIES}) reached. Please contact support for assistance.`
          );
        }

        // Count existing retries for this withdrawal
        const { data: existingRetries, error: retryError } = await supabase
          .from("withdrawal_requests")
          .select("id")
          .eq("original_withdrawal_id", withdrawalRequestId);

        if (retryError) {
          console.error("Error checking retry count:", retryError);
        }

        const totalRetries = (existingRetries?.length || 0) + retryCount;
        
        if (totalRetries >= MAX_RETRIES) {
          throw new Error(
            `Maximum retry limit (${MAX_RETRIES}) reached. Please contact support for assistance.`
          );
        }

        // Update the original withdrawal's retry tracking
        await supabase
          .from("withdrawal_requests")
          .update({
            retry_count: retryCount + 1,
            last_retry_at: new Date().toISOString(),
          })
          .eq("id", withdrawalRequestId);

        // Retry with the same parameters (cannot change payment method)
        return callSupabaseFunction("immediate-withdrawal", {
          credits_amount: originalRequest.credits_amount,
          payment_method: originalRequest.payment_method,
          payment_details: originalRequest.payment_details,
          notes: `Retry ${retryCount + 1}/${MAX_RETRIES} of withdrawal ${withdrawalRequestId}`,
          original_withdrawal_id: withdrawalRequestId,
        });
      } finally {
        // Always remove from ongoing set
        ongoingRetries.delete(withdrawalRequestId);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["credit_wallet", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["credit_transactions", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["withdrawal_requests", user?.id] });
      
      if (data.pending) {
        toast.info(
          "Retry successful! Withdrawal is being processed.",
          { duration: 5000 }
        );
      } else {
        toast.success(
          `Retry successful! MWK ${data.amount_mwk?.toLocaleString()} sent to your mobile money.`,
          { duration: 6000 }
        );
      }
    },
    onError: (error: any) => {
      const errorMsg = error.message || "Failed to retry withdrawal";
      toast.error(errorMsg, { duration: 5000 });
    },
  });

  return {
    // Wallet data
    wallet,
    walletLoading,
    balance: wallet?.balance || 0,
    totalEarned: wallet?.total_earned || 0,
    totalSpent: wallet?.total_spent || 0,

    // Packages
    packages,
    packagesLoading,

    // Transactions with pagination
    transactions,
    transactionsLoading,
    totalTransactions,
    hasMoreTransactions: hasNextPage,
    loadMoreTransactions: fetchNextPage,
    isLoadingMore: isFetchingNextPage,

    // Withdrawal requests
    withdrawalRequests,
    withdrawalsLoading,

    // Mutations
    purchaseCredits,
    enrollWithCredits,
    requestWithdrawal,
    retryWithdrawal,
  };
}
