// @ts-ignore: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

// Deno global type declaration for IDE
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ManageCoachSubscriptionRequest = {
  action: "cancel";
  subscription_id: string;
  reason?: string;
  cancel_immediately?: boolean;
};

interface SubscriptionRow {
  id: string;
  coach_id: string;
  status: string;
  start_date: string;
  renewal_date: string | null;
  billing_cycle: string;
  transaction_id: string | null;
  end_date: string | null;
}

interface RoleRow {
  role: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let supabase: ReturnType<typeof createClient> | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment configuration");
    }

    supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: ManageCoachSubscriptionRequest | null = null;
    try {
      body = await req.json();
    } catch (jsonErr) {
      const msg = jsonErr instanceof Error ? jsonErr.message : "Invalid JSON";
      return new Response(JSON.stringify({ error: `Invalid request body: ${msg}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body || body.action !== "cancel") {
      return new Response(JSON.stringify({ error: "Unsupported action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subscription_id, reason, cancel_immediately = true } = body;

    if (!subscription_id) {
      return new Response(JSON.stringify({ error: "subscription_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle() as { data: RoleRow | null };

    const userRole = roleRow?.role ?? null;
    const isAdmin = userRole === "admin";

    const { data: subscription, error: subscriptionError } = await supabase
      .from("coach_subscriptions")
      .select("id, coach_id, status, start_date, renewal_date, billing_cycle, transaction_id, end_date")
      .eq("id", subscription_id)
      .single() as { data: SubscriptionRow | null; error: any };

    if (subscriptionError || !subscription) {
      return new Response(JSON.stringify({ error: "Subscription not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (subscription.coach_id !== user.id && !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (subscription.status === "cancelled") {
      return new Response(
        JSON.stringify({
          success: true,
          status: "already_cancelled",
          cancelled_effective_at: subscription.end_date,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cancellableStatuses = new Set(["active", "pending"]);
    if (!cancellableStatuses.has(subscription.status)) {
      return new Response(JSON.stringify({ error: `Cannot cancel subscription in status ${subscription.status}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const effectiveEndDate = cancel_immediately
      ? now.toISOString()
      : subscription.renewal_date ?? now.toISOString();

    const { error: updateError } = await (supabase as any)
      .from("coach_subscriptions")
      .update({
        status: "cancelled",
        end_date: effectiveEndDate,
        renewal_date: cancel_immediately ? null : subscription.renewal_date,
      })
      .eq("id", subscription.id);

    if (updateError) {
      throw updateError;
    }

    await (supabase as any).from("subscription_audit_log").insert({
      subscription_id: subscription.id,
      subscription_type: "coach",
      old_status: subscription.status,
      new_status: "cancelled",
      changed_by: user.id,
      change_reason: reason || (cancel_immediately ? "cancel_immediate" : "cancel_at_period_end"),
      metadata: {
        cancel_immediately,
        requested_by: user.id,
        requested_role: userRole,
        requested_at: now.toISOString(),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        status: "cancelled",
        cancelled_effective_at: effectiveEndDate,
        cancel_immediately,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("manage-coach-subscription error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

