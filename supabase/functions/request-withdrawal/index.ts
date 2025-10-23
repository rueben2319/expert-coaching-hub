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
  "Access-Control-Allow-Methods": "OPTIONS, POST",
  "Access-Control-Max-Age": "86400",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is a coach
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!userRole || (userRole.role !== "coach" && userRole.role !== "admin")) {
      return new Response(JSON.stringify({ error: "Only coaches can request withdrawals" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const body = await req.json();
    const { credits_amount, payment_method, payment_details, notes } = body;

    if (!credits_amount || !payment_method || !payment_details) {
      return new Response(
        JSON.stringify({ error: "credits_amount, payment_method, and payment_details are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const creditsToWithdraw = Number(credits_amount);

    if (creditsToWithdraw <= 0) {
      return new Response(JSON.stringify({ error: "Amount must be positive" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get coach's wallet
    const { data: wallet, error: walletErr } = await supabase
      .from("credit_wallets")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (walletErr || !wallet) {
      return new Response(JSON.stringify({ error: "Wallet not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentBalance = Number(wallet.balance);

    if (currentBalance < creditsToWithdraw) {
      return new Response(
        JSON.stringify({
          error: "Insufficient balance",
          current_balance: currentBalance,
          requested: creditsToWithdraw,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate MWK amount (1 credit = 100 MWK conversion rate)
    // You can adjust this conversion rate as needed
    const conversionRate = 100; // 1 credit = 100 MWK
    const amountMWK = creditsToWithdraw * conversionRate;

    // Create withdrawal request
    const { data: withdrawalRequest, error: requestErr } = await supabase
      .from("withdrawal_requests")
      .insert({
        coach_id: user.id,
        amount: amountMWK,
        credits_amount: creditsToWithdraw,
        status: "pending",
        payment_method: payment_method,
        payment_details: payment_details,
        notes: notes || null,
      })
      .select()
      .single();

    if (requestErr) {
      console.error("Failed to create withdrawal request:", requestErr);
      throw new Error("Failed to create withdrawal request: " + requestErr.message);
    }

    // ✅ FIXED: Credits are NOT deducted here - they remain in wallet until admin approval
    // Admin will deduct credits when approving the withdrawal request

    return new Response(
      JSON.stringify({
        success: true,
        withdrawal_request_id: withdrawalRequest.id,
        credits_amount: creditsToWithdraw,
        amount_mwk: amountMWK,
        status: "pending",
        message: "Withdrawal request submitted successfully. Credits will be held until admin approval.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("Error in request-withdrawal:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
