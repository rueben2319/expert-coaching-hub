import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RevenueStats {
  daily: number;
  monthly: number;
  annual: number;
}

export interface SubscriptionStats {
  active: number;
  grace: number;
  failedRenewals: number;
}

export interface WithdrawalQueues {
  pending: number;
  processing: number;
}

export interface FailedTransactionCounts {
  last30Days: number;
}

export interface RevenueAggregates {
  coachSubscriptions: RevenueStats;
  creditPurchases: RevenueStats;
  total: RevenueStats;
}

export interface AdminOverviewDTO {
  subscriptions: SubscriptionStats;
  withdrawals: WithdrawalQueues;
  failedTransactions: FailedTransactionCounts;
  revenue: RevenueAggregates;
}

const emptyRevenueStats: RevenueStats = { daily: 0, monthly: 0, annual: 0 };

const calculateRevenueStats = (
  transactions: Array<{ amount: number; created_at: string }> | null,
  now: Date,
): RevenueStats => {
  if (!transactions?.length) return emptyRevenueStats;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  return transactions.reduce<RevenueStats>(
    (acc, transaction) => {
      const amount = Number(transaction.amount);
      const createdAt = new Date(transaction.created_at);

      if (createdAt >= today) acc.daily += amount;
      if (createdAt >= monthStart) acc.monthly += amount;
      if (createdAt >= yearStart) acc.annual += amount;

      return acc;
    },
    { daily: 0, monthly: 0, annual: 0 },
  );
};

export function useAdminOverviewData() {
  const subscriptionsQuery = useQuery({
    queryKey: ["admin-overview", "subscriptions"],
    queryFn: async (): Promise<SubscriptionStats> => {
      try {
        const [{ count: active }, { count: grace }, { count: failedRenewals }] = await Promise.all([
          supabase.from("coach_subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
          supabase.from("coach_subscriptions").select("*", { count: "exact", head: true }).eq("status", "grace"),
          supabase
            .from("coach_subscriptions")
            .select("*", { count: "exact", head: true })
            .eq("status", "expired")
            .gt("failed_renewal_attempts", 0),
        ]);

        return {
          active: active ?? 0,
          grace: grace ?? 0,
          failedRenewals: failedRenewals ?? 0,
        };
      } catch (error) {
        console.error("Error fetching subscription stats:", error);
        return { active: 0, grace: 0, failedRenewals: 0 };
      }
    },
  });

  const attentionQuery = useQuery({
    queryKey: ["admin-overview", "attention"],
    queryFn: async (): Promise<Pick<AdminOverviewDTO, "withdrawals" | "failedTransactions">> => {
      try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30).toISOString();

        const [{ count: pending }, { count: processing }, { count: failedTxns }] = await Promise.all([
          supabase.from("withdrawal_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
          supabase.from("withdrawal_requests").select("*", { count: "exact", head: true }).eq("status", "processing"),
          supabase
            .from("transactions")
            .select("*", { count: "exact", head: true })
            .eq("status", "failed")
            .gte("created_at", thirtyDaysAgo),
        ]);

        return {
          withdrawals: {
            pending: pending ?? 0,
            processing: processing ?? 0,
          },
          failedTransactions: {
            last30Days: failedTxns ?? 0,
          },
        };
      } catch (error) {
        console.error("Error fetching attention data:", error);
        return {
          withdrawals: { pending: 0, processing: 0 },
          failedTransactions: { last30Days: 0 },
        };
      }
    },
  });

  const revenueQuery = useQuery({
    queryKey: ["admin-overview", "revenue"],
    queryFn: async (): Promise<RevenueAggregates> => {
      try {
        const [coachResult, creditResult] = await Promise.all([
          supabase
            .from("transactions")
            .select("amount, created_at")
            .eq("transaction_mode", "coach_subscription")
            .eq("status", "success"),
          supabase
            .from("transactions")
            .select("amount, created_at")
            .eq("transaction_mode", "credit_purchase")
            .eq("status", "success"),
        ]);

        const now = new Date();
        const coachSubscriptions = calculateRevenueStats(coachResult.data, now);
        const creditPurchases = calculateRevenueStats(creditResult.data, now);

        return {
          coachSubscriptions,
          creditPurchases,
          total: {
            daily: coachSubscriptions.daily + creditPurchases.daily,
            monthly: coachSubscriptions.monthly + creditPurchases.monthly,
            annual: coachSubscriptions.annual + creditPurchases.annual,
          },
        };
      } catch (error) {
        console.error("Error fetching revenue data:", error);
        return {
          coachSubscriptions: emptyRevenueStats,
          creditPurchases: emptyRevenueStats,
          total: emptyRevenueStats,
        };
      }
    },
  });

  const data = useMemo<AdminOverviewDTO>(
    () => ({
      subscriptions: subscriptionsQuery.data ?? { active: 0, grace: 0, failedRenewals: 0 },
      withdrawals: attentionQuery.data?.withdrawals ?? { pending: 0, processing: 0 },
      failedTransactions: attentionQuery.data?.failedTransactions ?? { last30Days: 0 },
      revenue: revenueQuery.data ?? {
        coachSubscriptions: emptyRevenueStats,
        creditPurchases: emptyRevenueStats,
        total: emptyRevenueStats,
      },
    }),
    [subscriptionsQuery.data, attentionQuery.data, revenueQuery.data],
  );

  return {
    data,
    sections: {
      attention: {
        isLoading: attentionQuery.isLoading || subscriptionsQuery.isLoading,
        isError: attentionQuery.isError || subscriptionsQuery.isError,
        retry: () => {
          attentionQuery.refetch();
          subscriptionsQuery.refetch();
        },
      },
      revenue: {
        isLoading: revenueQuery.isLoading,
        isError: revenueQuery.isError,
        retry: revenueQuery.refetch,
      },
      quickLinks: {
        isLoading: false,
        isError: false,
        retry: () => undefined,
      },
    },
  };
}
