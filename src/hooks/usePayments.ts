import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callSupabaseFunction } from "@/lib/supabaseFunctions";

export function usePayments() {
  const createCoachSubscription = useCallback(async (tierId: string, billingCycle: "monthly" | "yearly", currency?: string) => {
    // Forward authenticated request using helper
    return await callSupabaseFunction("create-payment-link", { mode: "coach_subscription", tier_id: tierId, billing_cycle: billingCycle, currency });
  }, []);

  const createClientOneTimeOrder = useCallback(async (coachId: string, courseId: string, amount: number, currency?: string) => {
    return await callSupabaseFunction("create-payment-link", { mode: "client_one_time", coach_id: coachId, course_id: courseId, amount, currency });
  }, []);

  const createClientSubscription = useCallback(async (coachId: string, amount: number, billingCycle: "monthly" | "yearly", currency?: string) => {
    return await callSupabaseFunction("create-payment-link", { mode: "client_subscription", coach_id: coachId, amount, billing_cycle: billingCycle, currency });
  }, []);

  const getPurchaseHistory = useCallback(async () => {
    return await callSupabaseFunction("get-user-purchase-history", {});
  }, []);

  return {
    createCoachSubscription,
    createClientOneTimeOrder,
    createClientSubscription,
    getPurchaseHistory,
  };
}
