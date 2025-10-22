import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
        .single();

      if (error) throw error;
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

  // Fetch credit transactions
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["credit_transactions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  // Purchase credits mutation
  const purchaseCredits = useMutation({
    mutationFn: async (packageId: string) => {
      return callSupabaseFunction("purchase-credits", { package_id: packageId });
    },
    onSuccess: (data) => {
      // Redirect to PayChangu checkout
      window.location.href = data.checkout_url;
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

  // Request withdrawal
  const requestWithdrawal = useMutation({
    mutationFn: async (params: {
      credits_amount: number;
      payment_method: string;
      payment_details: any;
      notes?: string;
    }) => {
      return callSupabaseFunction("request-withdrawal", params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit_wallet", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["credit_transactions", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["withdrawal_requests", user?.id] });
      toast.success("Withdrawal request submitted successfully!");
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

    // Transactions
    transactions,
    transactionsLoading,

    // Withdrawal requests
    withdrawalRequests,
    withdrawalsLoading,

    // Mutations
    purchaseCredits,
    enrollWithCredits,
    requestWithdrawal,
  };
}
