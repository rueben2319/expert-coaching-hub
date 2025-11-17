import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callSupabaseFunction } from "@/lib/supabaseFunctions";

export function usePayments() {
  const createCoachSubscription = useCallback(async (tierId: string, billingCycle: "monthly" | "yearly", currency?: string) => {
    // Forward authenticated request using helper
    return await callSupabaseFunction("create-payment-link", { mode: "coach_subscription", tier_id: tierId, billing_cycle: billingCycle, currency });
  }, []);

  const cancelCoachSubscription = useCallback(async (subscriptionId: string, reason?: string, cancelImmediately: boolean = true) => {
    return await callSupabaseFunction("manage-coach-subscription", {
      action: "cancel",
      subscription_id: subscriptionId,
      reason,
      cancel_immediately: cancelImmediately,
    });
  }, []);

  const getPurchaseHistory = useCallback(async () => {
    return await callSupabaseFunction("get-user-purchase-history", {});
  }, []);

  return {
    createCoachSubscription,
    cancelCoachSubscription,
    getPurchaseHistory,
  };
}
