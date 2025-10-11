// @ts-ignore: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type BillingCycle = "monthly" | "yearly";

type Mode = "coach_subscription" | "client_one_time" | "client_subscription";

interface CreatePaymentRequest {
  mode: Mode;
  tier_id?: string;
  billing_cycle?: BillingCycle;
  coach_id?: string;
  course_id?: string | null;
  amount?: number; // required for client_* modes unless price derived elsewhere
  currency?: string; // defaults to PAYCHANGU_DEFAULT_CURRENCY or MWK
  return_url?: string;
  metadata?: Record<string, unknown>;
}

interface PayChanguResponse {
  message: string;
  status: string;
  data?: {
    checkout_url?: string;
    data?: { tx_ref?: string; status?: string; amount?: number; currency?: string };
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase environment configuration");

    const paychanguSecret = Deno.env.get("PAYCHANGU_SECRET_KEY");
    if (!paychanguSecret) throw new Error("Missing PAYCHANGU_SECRET_KEY env var");

    const defaultCurrency = Deno.env.get("PAYCHANGU_DEFAULT_CURRENCY") || "MWK";
    const appBaseUrl = Deno.env.get("APP_BASE_URL");

    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Fetch user role server-side to enforce permissions
    const { data: roleRow, error: roleErr } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    const userRole = roleRow?.role || null;

    const body = (await req.json()) as CreatePaymentRequest;
    const mode = body.mode;

    if (!mode) throw new Error("mode is required");

    // For coach subscription, ensure the user is a coach (or admin)
    if (mode === "coach_subscription") {
      if (userRole !== "coach" && userRole !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden: user must be a coach to subscribe to coach plans" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // For client modes, ensure user is a client (or admin)
    if (mode === "client_one_time" || mode === "client_subscription") {
      if (userRole !== "client" && userRole !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden: user must be a client to purchase courses" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Fetch profile for payer details
    const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("id", user.id).single();

    const tx_ref = crypto.randomUUID();
    const currency = body.currency || defaultCurrency;

    let amount = body.amount ?? 0;
    let orderId: string | null = null;
    let subscriptionId: string | null = null;
    let description = "";

    if (mode === "coach_subscription") {
      if (!body.tier_id) throw new Error("tier_id is required for coach_subscription");
      const cycle: BillingCycle = body.billing_cycle || "monthly";
      const { data: tier, error: tierErr } = await supabase
        .from("tiers")
        .select("id, name, price_monthly, price_yearly")
        .eq("id", body.tier_id)
        .single();
      if (tierErr || !tier) throw new Error("Tier not found");

      amount = cycle === "yearly" ? tier.price_yearly : tier.price_monthly;
      description = `Coach subscription: ${tier.name} (${cycle})`;

      const startDate = new Date().toISOString();
      const { data: sub, error: subErr } = await supabase
        .from("coach_subscriptions")
        .insert({
          coach_id: user.id,
          tier_id: tier.id,
          status: "pending",
          start_date: startDate,
          end_date: null,
          renewal_date: null,
          transaction_id: null,
          payment_method: "paychangu",
          billing_cycle: cycle,
        })
        .select()
        .single();
      if (subErr || !sub) throw new Error("Failed to create subscription record");
      subscriptionId = sub.id;

    } else if (mode === "client_one_time") {
      if (!body.coach_id) throw new Error("coach_id is required for client_one_time");
      if (!body.course_id) throw new Error("course_id is required for client_one_time");
      if (typeof body.amount !== "number" || body.amount <= 0) throw new Error("valid amount is required for client_one_time");
      amount = body.amount;
      description = `One-time purchase for course ${body.course_id}`;

      const { data: ord, error: ordErr } = await supabase
        .from("client_orders")
        .insert({
          client_id: user.id,
          coach_id: body.coach_id,
          type: "one_time",
          amount,
          currency,
          status: "pending",
          transaction_id: null,
          course_id: body.course_id,
          start_date: new Date().toISOString(),
          end_date: null,
        })
        .select()
        .single();
      if (ordErr || !ord) throw new Error("Failed to create order record");
      orderId = ord.id;

    } else if (mode === "client_subscription") {
      if (!body.coach_id) throw new Error("coach_id is required for client_subscription");
      const cycle: BillingCycle = body.billing_cycle || "monthly";
      if (typeof body.amount !== "number" || body.amount <= 0) throw new Error("valid amount is required for client_subscription");
      amount = body.amount;
      description = `Client subscription to coach ${body.coach_id} (${cycle})`;

      const { data: ord, error: ordErr } = await supabase
        .from("client_orders")
        .insert({
          client_id: user.id,
          coach_id: body.coach_id,
          type: cycle,
          amount,
          currency,
          status: "pending",
          transaction_id: null,
          course_id: null,
          start_date: new Date().toISOString(),
          end_date: null,
        })
        .select()
        .single();
      if (ordErr || !ord) throw new Error("Failed to create order record");
      orderId = ord.id;
    } else {
      throw new Error("Unsupported mode");
    }

    // Create transaction record (pending)
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        transaction_ref: tx_ref,
        amount,
        currency,
        status: "pending",
        gateway_response: null,
        order_id: orderId,
        subscription_id: subscriptionId,
      })
      .select()
      .single();

    if (txErr || !tx) throw new Error("Failed to create transaction record");

    const callbackUrl = Deno.env.get("PAYCHANGU_WEBHOOK_URL") || `${supabaseUrl}/functions/v1/paychangu-webhook`;
    const returnUrl = body.return_url || (appBaseUrl ? `${appBaseUrl}/billing/return` : `${supabaseUrl}/functions/v1/paychangu-webhook`);

    const first_name = profile?.full_name?.split(" ")[0] || "";
    const last_name = profile?.full_name?.split(" ").slice(1).join(" ") || "";

    const payPayload = {
      amount: String(amount),
      currency,
      email: profile?.email || user.email,
      first_name,
      last_name,
      callback_url: callbackUrl,
      return_url: returnUrl,
      tx_ref,
      customization: {
        title: "Experts Coaching Hub",
        description,
      },
      meta: {
        mode,
        order_id: orderId,
        subscription_id: subscriptionId,
        user_id: user.id,
        ...body.metadata,
      },
    };

    const resp = await fetch("https://api.paychangu.com/payment", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${paychanguSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payPayload),
    });

    const data = (await resp.json()) as PayChanguResponse;

    if (!resp.ok || data.status !== "success" || !data.data?.checkout_url) {
      await supabase.from("transactions").update({ status: "failed", gateway_response: data }).eq("id", tx.id);
      return new Response(JSON.stringify({ error: "Failed to initialize payment", details: data }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(
      JSON.stringify({
        checkout_url: data.data.checkout_url,
        transaction_ref: tx_ref,
        order_id: orderId,
        subscription_id: subscriptionId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
