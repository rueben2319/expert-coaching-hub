import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePayments() {
  const createCoachSubscription = useCallback(async (tierId: string, billingCycle: "monthly" | "yearly", currency?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const res = await fetch(`${supabase.storageUrl?.replace("/storage/v1", "") || (supabase as any).url}/functions/v1/create-payment-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ mode: "coach_subscription", tier_id: tierId, billing_cycle: billingCycle, currency }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to create payment");
    return json as { checkout_url: string; transaction_ref: string; subscription_id: string };
  }, []);

  const createClientOneTimeOrder = useCallback(async (coachId: string, courseId: string, amount: number, currency?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const res = await fetch(`${supabase.storageUrl?.replace("/storage/v1", "") || (supabase as any).url}/functions/v1/create-payment-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ mode: "client_one_time", coach_id: coachId, course_id: courseId, amount, currency }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to create payment");
    return json as { checkout_url: string; transaction_ref: string; order_id: string };
  }, []);

  const createClientSubscription = useCallback(async (coachId: string, amount: number, billingCycle: "monthly" | "yearly", currency?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const res = await fetch(`${supabase.storageUrl?.replace("/storage/v1", "") || (supabase as any).url}/functions/v1/create-payment-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ mode: "client_subscription", coach_id: coachId, amount, billing_cycle: billingCycle, currency }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to create payment");
    return json as { checkout_url: string; transaction_ref: string; order_id: string };
  }, []);

  const getPurchaseHistory = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const res = await fetch(`${supabase.storageUrl?.replace("/storage/v1", "") || (supabase as any).url}/functions/v1/get-user-purchase-history`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to load history");
    return json as { invoices: any[]; orders: any[]; subscriptions: any[]; transactions: any[] };
  }, []);

  return {
    createCoachSubscription,
    createClientOneTimeOrder,
    createClientSubscription,
    getPurchaseHistory,
  };
}
