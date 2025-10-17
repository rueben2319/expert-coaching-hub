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

type BillingCycle = "monthly" | "yearly";

type Mode = "coach_subscription";

interface CreatePaymentRequest {
  mode: Mode;
  tier_id?: string;
  billing_cycle?: BillingCycle;
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

  // Initialize variables for cleanup in catch block
  let supabase: any;
  let subscriptionId: string | null = null;

  try {
    console.log("Starting payment link creation");

    console.log("Checking environment variables");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase environment configuration");
    console.log("Supabase env vars OK");

    const paychanguSecret = Deno.env.get("PAYCHANGU_SECRET_KEY");
    console.log("PAYCHANGU_SECRET_KEY present:", !!paychanguSecret);
    if (!paychanguSecret) {
      console.log("PAYCHANGU_SECRET_KEY is missing");
      throw new Error("Missing PAYCHANGU_SECRET_KEY env var");
    }
    console.log("PayChangu env var OK");

    const defaultCurrency = Deno.env.get("PAYCHANGU_DEFAULT_CURRENCY") || "MWK";
    const appBaseUrl = Deno.env.get("APP_BASE_URL");
    console.log("APP_BASE_URL:", appBaseUrl);

    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("Supabase client created");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("No authorization header found");
      return new Response(JSON.stringify({ error: "No authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.log("Authorization header present");

    const token = authHeader.replace("Bearer ", "");
    console.log("Getting user from token");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error("User auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized", details: userError?.message }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("User authenticated:", user.id);

    // Fetch user role server-side to enforce permissions
    const { data: roleRow, error: roleErr } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    const userRole = roleRow?.role || null;
    console.log("User role:", userRole);

    console.log("Parsing request body");
    console.log("Request method:", req.method);
    console.log("Content-Type:", req.headers.get("Content-Type"));

    // Log the raw body text before parsing
    let rawBody;
    try {
      rawBody = await req.text();
      console.log("Raw request body:", rawBody);
    } catch (textError) {
      console.error("Failed to read request as text:", textError);
      throw new Error(`Cannot read request body: ${textError.message}`);
    }

    if (!rawBody || rawBody.trim() === "") {
      console.log("Request body is empty!");
      throw new Error("Request body is empty");
    }

    let body;
    try {
      body = JSON.parse(rawBody);
      console.log("Request body parsed successfully");
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      throw new Error(`Invalid JSON in request body: ${parseError.message}`);
    }
    console.log("Request body:", JSON.stringify(body, null, 2));
    const mode = body.mode;

    if (!mode) throw new Error("mode is required");

    // Use platform PayChangu secret for all payments
    const paymentSecret = paychanguSecret;

    // For coach subscription, ensure the user is a coach (or admin)
    if (mode === "coach_subscription") {
      if (userRole !== "coach" && userRole !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden: user must be a coach to subscribe to coach plans" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Fetch profile for payer details
    const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("id", user.id).single();

    const tx_ref = crypto.randomUUID();
    const currency = body.currency || defaultCurrency;

    let amount = body.amount ?? 0;
    let subscriptionId: string | null = null;
    let description = "";

    if (mode === "coach_subscription") {
      if (!body.tier_id) throw new Error("tier_id is required for coach_subscription");
      const cycle: BillingCycle = body.billing_cycle || "monthly";
      console.log("Looking up tier:", body.tier_id);
      const { data: tier, error: tierErr } = await supabase
        .from("tiers")
        .select("id, name, price_monthly, price_yearly")
        .eq("id", body.tier_id)
        .single();
      console.log("Tier lookup result:", { tier, tierErr });
      if (tierErr || !tier) throw new Error("Tier not found");

      amount = cycle === "yearly" ? tier.price_yearly : tier.price_monthly;
      description = `Coach subscription: ${tier.name} (${cycle})`;

      const startDate = new Date().toISOString();
      console.log("Creating subscription record");
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
      console.log("Subscription creation result:", { sub, subErr });
      if (subErr || !sub) throw new Error("Failed to create subscription record");
      subscriptionId = sub.id;

    } else {
      throw new Error("Unsupported mode");
    }

    // Create transaction record (pending)
    console.log("Creating transaction record...");
    const transactionData: any = {
      user_id: user.id,
      transaction_ref: tx_ref,
      amount,
      currency,
      status: "pending",
      gateway_response: null,
      subscription_id: subscriptionId,
    };

    console.log("Transaction data:", transactionData);

    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .insert(transactionData)
      .select()
      .single();

    console.log("Transaction creation result:", { tx, txErr });
    if (txErr || !tx) throw new Error("Failed to create transaction record");

    const callbackUrl = Deno.env.get("PAYCHANGU_WEBHOOK_URL") || `${supabaseUrl}/functions/v1/paychangu-webhook`;

    // Set return URL for coach subscription
    let returnUrl = body.return_url;
    if (!returnUrl && appBaseUrl) {
      returnUrl = `${appBaseUrl}/coach/billing/success`;
    }
    returnUrl = returnUrl || `${supabaseUrl}/functions/v1/paychangu-webhook`;
    console.log("Final return_url:", returnUrl);

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
        subscription_id: subscriptionId,
        user_id: user.id,
        ...body.metadata,
      },
    };

    console.log("About to call PayChangu API");
    console.log("Payment payload:", JSON.stringify(payPayload, null, 2));
    console.log("Using payment secret (first 10 chars):", paymentSecret.substring(0, 10) + "...");

    const resp = await fetch("https://api.paychangu.com/payment", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${paymentSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payPayload),
    });

    console.log("PayChangu response status:", resp.status);
    console.log("PayChangu response headers:", Object.fromEntries(resp.headers.entries()));

    const data = (await resp.json()) as PayChanguResponse;
    console.log("PayChangu response data:", JSON.stringify(data, null, 2));

    if (!resp.ok || data.status !== "success" || !data.data?.checkout_url) {
      console.log("PayChangu payment initialization failed!");
      console.log("Response status:", resp.status);
      console.log("Response data:", data);
      // Payment initialization failed - clean up created records
      console.log("Payment initialization failed, cleaning up records");

      // Update transaction status to failed
      await supabase.from("transactions").update({ status: "failed", gateway_response: data }).eq("id", tx.id);

      // Clean up subscription records that were created but never paid for
      if (subscriptionId) {
        console.log("Deleting unpaid subscription:", subscriptionId);
        await supabase
          .from("coach_subscriptions")
          .delete()
          .eq("id", subscriptionId);
      }

      return new Response(JSON.stringify({
        error: "Failed to initialize payment",
        details: data,
        debug: {
          mode,
          responseStatus: resp.status
        }
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(
      JSON.stringify({
        checkout_url: data.data.checkout_url,
        transaction_ref: tx_ref,
        subscription_id: subscriptionId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";

    // Clean up any records that were created but payment failed
    try {
      if (subscriptionId) {
        console.log("Cleaning up unpaid subscription due to error:", subscriptionId);
        await supabase.from("coach_subscriptions").delete().eq("id", subscriptionId);
      }
    } catch (cleanupError) {
      console.error("Error during cleanup:", cleanupError);
    }

    return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
