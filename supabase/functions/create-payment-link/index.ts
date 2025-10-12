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

    const supabase = createClient(supabaseUrl, supabaseKey);
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
      if (!body.package_id) throw new Error("package_id is required for client_subscription");
      const cycle: BillingCycle = body.billing_cycle || "monthly";
      if (typeof body.amount !== "number" || body.amount <= 0) throw new Error("valid amount is required for client_subscription");
      amount = body.amount;
      description = `Subscription to coach package (${cycle})`;

      // Create client subscription record
      const { data: sub, error: subErr } = await supabase
        .from("client_subscriptions")
        .insert({
          client_id: user.id,
          coach_id: body.coach_id,
          package_id: body.package_id,
          billing_cycle: cycle,
          start_date: new Date().toISOString(),
          end_date: null,
          renewal_date: null, // Will be set on activation
          transaction_id: null,
          payment_method: "paychangu",
        })
        .select()
        .single();
      if (subErr || !sub) throw new Error("Failed to create subscription record");
      subscriptionId = sub.id;
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

    // Set return URL based on mode
    let returnUrl = body.return_url;
    if (!returnUrl && appBaseUrl) {
      if (mode === "coach_subscription") {
        returnUrl = `${appBaseUrl}/coach/billing/success`;
      } else {
        returnUrl = `${appBaseUrl}/client/billing/success`; // For future client success page
      }
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
