import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePayments() {
  const createCoachSubscription = useCallback(async (tierId: string, billingCycle: "monthly" | "yearly", currency?: string) => {
    const { data, error } = await supabase.functions.invoke("create-payment-link", {
      body: { mode: "coach_subscription", tier_id: tierId, billing_cycle: billingCycle, currency },
    });
    if (error) throw error;
    return data as { checkout_url: string; transaction_ref: string; subscription_id: string };
  }, []);

  const createClientOneTimeOrder = useCallback(async (coachId: string, courseId: string, amount: number, currency?: string) => {
    const { data, error } = await supabase.functions.invoke("create-payment-link", {
      body: { mode: "client_one_time", coach_id: coachId, course_id: courseId, amount, currency },
    });
    if (error) throw error;
    return data as { checkout_url: string; transaction_ref: string; order_id: string };
  }, []);

  const createClientSubscription = useCallback(async (coachId: string, amount: number, billingCycle: "monthly" | "yearly", currency?: string) => {
    const { data, error } = await supabase.functions.invoke("create-payment-link", {
      body: { mode: "client_subscription", coach_id: coachId, amount, billing_cycle: billingCycle, currency },
    });
    if (error) throw error;
    return data as { checkout_url: string; transaction_ref: string; order_id: string };
  }, []);

  const getPurchaseHistory = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("get-user-purchase-history", {});
    if (error) throw error;
    return data as { invoices: any[]; orders: any[]; subscriptions: any[]; transactions: any[] };
  }, []);

  return {
    createCoachSubscription,
    createClientOneTimeOrder,
    createClientSubscription,
    getPurchaseHistory,
  };
}
