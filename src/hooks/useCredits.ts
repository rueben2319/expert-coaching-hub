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
      return callSupabaseFunction("immediate-withdrawal", params); // ✅ Changed to immediate-withdrawal
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit_wallet", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["credit_transactions", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["withdrawal_requests", user?.id] });
      toast.success("Withdrawal initiated successfully! Check your mobile money shortly.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to submit withdrawal request");
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
  };
}
