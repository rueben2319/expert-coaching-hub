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

  const createClientSubscription = useCallback(async (coachId: string, packageId: string, billingCycle: "monthly" | "yearly", currency?: string) => {
    return await callSupabaseFunction("create-payment-link", { mode: "client_subscription", coach_id: coachId, package_id: packageId, billing_cycle: billingCycle, currency });
  }, []);

  const getPurchaseHistory = useCallback(async () => {
    return await callSupabaseFunction("get-user-purchase-history", {});
  }, []);

  const getClientSubscriptions = useCallback(async () => {
    const { data, error } = await supabase
      .from("client_subscriptions")
      .select(`
        id,
        status,
        billing_cycle,
        start_date,
        end_date,
        renewal_date,
        coach_packages (
          id,
          name,
          price_monthly,
          price_yearly,
          coach_id
        )
      `)
      .eq("client_id", (await supabase.auth.getUser()).data.user?.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Fetch profiles separately for each coach
    const subscriptionsWithProfiles = await Promise.all(
      data.map(async (sub) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .eq("id", sub.coach_packages.coach_id)
          .single();

        return {
          ...sub,
          coach_packages: {
            ...sub.coach_packages,
            profiles: profile
          }
        };
      })
    );

    return subscriptionsWithProfiles;
  }, []);

  const getCoachPackages = useCallback(async () => {
    const { data, error } = await supabase
      .from("coach_packages")
      .select(`
        id,
        name,
        description,
        price_monthly,
        price_yearly,
        features,
        coach_id
      `)
      .eq("is_active", true)
      .order("price_monthly", { ascending: true });

    if (error) throw error;

    // Fetch profiles separately for each coach
    const packagesWithProfiles = await Promise.all(
      data.map(async (pkg) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .eq("id", pkg.coach_id)
          .single();

        return {
          ...pkg,
          profiles: profile
        };
      })
    );

    return packagesWithProfiles;
  }, []);

  return {
    createCoachSubscription,
    createClientOneTimeOrder,
    createClientSubscription,
    getPurchaseHistory,
    getClientSubscriptions,
    getCoachPackages,
  };
}
