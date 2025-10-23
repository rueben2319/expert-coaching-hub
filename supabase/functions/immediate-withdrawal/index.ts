// @ts-ignore: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

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

// Function to get operator ID from PayChangu
async function getOperatorId(payChanguSecret: string, phoneNumber: string): Promise<string> {
  try {
    // Clean phone number (remove +265 prefix if present, keep just the number)
    const cleanNumber = phoneNumber.replace(/^\+?265/, "");

    // Get operators from PayChangu
    const operatorsResponse = await fetch("https://api.paychangu.com/operators", {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${payChanguSecret}`
      },
    });

    if (!operatorsResponse.ok) {
      throw new Error("Failed to fetch operators from PayChangu");
    }

    const operatorsData = await operatorsResponse.json();

    // Find the operator based on phone number prefix
    // Malawi mobile prefixes: Airtel (99, 88), TNM (77, 76)
    let operatorName = "";
    if (cleanNumber.startsWith("99") || cleanNumber.startsWith("88")) {
      operatorName = "Airtel";
    } else if (cleanNumber.startsWith("77") || cleanNumber.startsWith("76")) {
      operatorName = "TNM";
    } else {
      throw new Error("Unsupported mobile number prefix");
    }

    // Find the operator in the response
    const operator = operatorsData.data?.find((op: any) =>
      op.name.toLowerCase().includes(operatorName.toLowerCase()) &&
      op.country.toLowerCase().includes("malawi")
    );

    if (!operator) {
      throw new Error(`Operator not found for ${operatorName}`);
    }

    return operator.ref_id;
  } catch (error) {
    console.error("Error getting operator ID:", error);
    throw error;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const payChanguSecret = Deno.env.get("PAYCHANGU_SECRET_KEY");  // you’ll set this in env

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }
    if (!payChanguSecret) {
      throw new Error("Missing PayChangu secret key");
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

    // Calculate MWK amount (1 credit = 100 MWK conversion rate) – adjust if needed
    const conversionRate = 100; 
    const amountMWK = creditsToWithdraw * conversionRate;

    // Create withdrawal request row (status will reflect “processing”/“sent” rather than “pending approval”)
    const { data: withdrawalRequest, error: requestErr } = await supabase
      .from("withdrawal_requests")
      .insert({
        coach_id: user.id,
        amount: amountMWK,
        credits_amount: creditsToWithdraw,
        status: "processing",     // Changed from “pending” to “processing”
        payment_method: payment_method,
        payment_details: payment_details,
        notes: notes || null,
      })
      .select()
      .single();

    if (requestErr || !withdrawalRequest) {
      console.error("Failed to create withdrawal request:", requestErr);
      throw new Error("Failed to create withdrawal request: " + (requestErr?.message ?? ""));
    }

    // Get the correct operator ID from PayChangu
    const operatorId = await getOperatorId(payChanguSecret, payment_details.mobile);

    // Immediately call PayChangu payout API
    const payoutPayload = {
      mobile_money_operator_ref_id: operatorId, // ✅ Use fetched operator ID
      mobile: payment_details.mobile,
      amount: amountMWK.toString(),
      currency: "MWK",
      reason: "Coach withdrawal payout",
      charge_id: `WD-${withdrawalRequest.id}`
    };

    const payoutResponse = await fetch("https://api.paychangu.com/mobile-money/payouts/initialize", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${payChanguSecret}`
      },
      body: JSON.stringify(payoutPayload),
    });

    const payoutResult = await payoutResponse.json();
    if (!payoutResponse.ok || payoutResult.status !== "success") {
      // Handle payout failure: mark withdrawal request as failed
      await supabase
        .from("withdrawal_requests")
        .update({
          status: "failed",
          processed_at: new Date().toISOString(),
          admin_notes: `Payout API error: ${JSON.stringify(payoutResult)}`,
        })
        .eq("id", withdrawalRequest.id);

      return new Response(
        JSON.stringify({
          error: "Payout failed",
          payout_response: payoutResult
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // On success: deduct credits, record transaction, update request status
    const coachId = withdrawalRequest.coach_id;
    const creditsAmount = creditsToWithdraw;
    const balanceAfter = currentBalance - creditsAmount;

    // Deduct credits
    const { error: updateErr } = await supabase
      .from("credit_wallets")
      .update({
        balance: balanceAfter,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", coachId);

    if (updateErr) {
      console.error("Failed to update wallet:", updateErr);
      // You may still proceed — but you should alert/setup reconciliation
    }

    // Create credit transaction record
    const { error: creditTxErr } = await supabase
      .from("credit_transactions")
      .insert({
        user_id: coachId,
        transaction_type: "withdrawal",
        amount: -creditsAmount,
        balance_before: currentBalance,
        balance_after: balanceAfter,
        reference_type: "withdrawal_request",
        reference_id: withdrawalRequest.id,
        description: `Immediate withdrawal: ${creditsAmount} credits → ${amountMWK} MWK via PayChangu`,
        metadata: {
          payment_method: payment_method,
          amount_mwk: amountMWK,
          payout_ref: payoutResult.data.ref_id,
          payout_trans_id: payoutResult.data.trans_id
        }
      });

    if (creditTxErr) {
      console.error("Failed to create credit transaction:", creditTxErr);
    }

    // Update withdrawal request status
    const { error: statusErr } = await supabase
      .from("withdrawal_requests")
      .update({
        status: "completed", // ✅ Changed from "approved" to "completed"
        processed_at: new Date().toISOString(),
        processed_by: user.id,
        admin_notes: `Auto-approved via API. Payout ref: ${payoutResult.data.ref_id}`
      })
      .eq("id", withdrawalRequest.id);

    if (statusErr) {
      console.error("Failed to update withdrawal status:", statusErr);
      // alert for reconciliation
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        withdrawal_request_id: withdrawalRequest.id,
        credits_amount: creditsToWithdraw,
        amount_mwk: amountMWK,
        payout_ref: payoutResult.data.ref_id,
        payout_trans_id: payoutResult.data.trans_id,
        new_balance: balanceAfter,
        message: "Withdrawal executed via mobile money payout successfully."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("Error in immediate-withdrawal:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
