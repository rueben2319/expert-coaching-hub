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

/** ---------- Helper Functions ---------- **/

async function getOperatorId(payChanguSecret: string, phoneNumber: string) {
  try {
    console.log('DEBUG: Original mobile:', phoneNumber);
    const cleanNumber = phoneNumber.replace(/^\+?265/, '');
    console.log('DEBUG: Cleaned mobile:', cleanNumber);

    const operatorsResponse = await fetch('https://api.paychangu.com/mobile-money/', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${payChanguSecret}`,
      },
    });

    if (!operatorsResponse.ok) {
      console.error('Failed to fetch operators, status:', operatorsResponse.status);
      // Fallback to hardcoded operators for Malawi
      if (/^(99|88)/.test(cleanNumber)) {
        console.log('DEBUG: Using fallback Airtel operator');
        return 'AIRTEL_MW';
      } else if (/^(77|76)/.test(cleanNumber)) {
        console.log('DEBUG: Using fallback TNM operator');
        return 'TNM_MW';
      } else {
        throw new Error('Unsupported mobile number prefix');
      }
    }

    const operatorsData = await operatorsResponse.json();
    console.log('DEBUG: Operators API response:', JSON.stringify(operatorsData, null, 2));
    const operatorsList = operatorsData.data ?? [];

    let operatorName = '';
    if (/^(99|88)/.test(cleanNumber)) operatorName = 'Airtel';
    else if (/^(77|76)/.test(cleanNumber)) operatorName = 'TNM';
    else throw new Error('Unsupported mobile number prefix');

    console.log('DEBUG: Looking for operator:', operatorName);
    console.log('DEBUG: Total operators found:', operatorsList.length);

    let foundOperator: any = null;
    for (const op of operatorsList) {
      console.log('DEBUG: Evaluating operator:', JSON.stringify(op, null, 2));
      if (!op || !op.name || !op.supported_country || !op.supported_country.name) {
        console.log('DEBUG: Skipping invalid operator - missing fields');
        continue;
      }
      const nameMatch = op.name.toLowerCase().includes(operatorName.toLowerCase());
      const countryMatch = op.supported_country.name.toLowerCase() === 'malawi';
      console.log(`DEBUG: ${op.name} - nameMatch: ${nameMatch}, countryMatch: ${countryMatch}`);
      if (nameMatch && countryMatch) {
        console.log('DEBUG: Found matching operator:', op);
        foundOperator = op;
        break;
      }
    }

    if (foundOperator) {
      console.log('DEBUG: Using found operator with ref_id:', foundOperator.ref_id);
      return foundOperator.ref_id;
    }

    console.log('DEBUG: Operator not found in API, using fallback');
    // Fallback operators
    if (operatorName === 'Airtel') return 'AIRTEL_MW';
    if (operatorName === 'TNM') return 'TNM_MW';
    throw new Error(`Operator not found for ${operatorName}`);
  } catch (err) {
    console.error('Error getting operator ID:', err);
    throw new Error('Failed to determine mobile operator');
  }
}

async function authenticateUser(supabase: any, token: string) {
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  return user;
}

async function verifyCoachRole(supabase: any, userId: string) {
  const { data: userRole, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (error || !userRole || !["coach", "admin"].includes(userRole.role)) {
    throw new Error("Only coaches can request withdrawals");
  }
  return true;
}

function validateRequestBody(body: any) {
  const { credits_amount, payment_method, payment_details } = body;
  if (!credits_amount || !payment_method || !payment_details) {
    const missing = ["credits_amount", "payment_method", "payment_details"].filter(
      (k) => !body[k]
    );
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }

  const creditsNum = Number(credits_amount);
  if (isNaN(creditsNum) || creditsNum <= 0) throw new Error("Amount must be positive");

  if (payment_method === "mobile_money") {
    const mobile = payment_details.mobile;
    if (!mobile) throw new Error("Missing mobile number for mobile money payment");
    const cleanNumber = mobile.replace(/^\+?265/, "");
    if (!/^(99|88|77|76)\d{7}$/.test(cleanNumber)) {
      throw new Error("Invalid mobile number format. Example: +265999123456");
    }
  }

  return { creditsToWithdraw: creditsNum, payment_method, payment_details };
}

async function getWalletBalance(supabase: any, userId: string) {
  const { data: wallet, error } = await supabase
    .from("credit_wallets")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error || !wallet) throw new Error("Wallet not found");
  return Number(wallet.balance);
}

async function createWithdrawalRequest(
  supabase: any,
  userId: string,
  credits: number,
  amountMWK: number,
  payment_method: string,
  payment_details: any,
  notes?: string
) {
  const { data, error } = await supabase
    .from("withdrawal_requests")
    .insert({
      coach_id: userId,
      credits_amount: credits,
      amount: amountMWK,
      status: "processing",
      payment_method,
      payment_details,
      notes: notes || null,
    })
    .select()
    .single();

  if (error || !data) throw new Error("Failed to create withdrawal request");
  return data;
}

async function executePayout(
  payChanguSecret: string,
  withdrawal: any,
  payment_details: any,
  operatorId: string,
  amountMWK: number
) {
  // Ensure mobile number is exactly 9 digits
  const cleanMobile = payment_details.mobile.replace(/^\+?265/, '');
  console.log('DEBUG: Formatted mobile for payout:', cleanMobile);

  if (!/^\d{9}$/.test(cleanMobile)) {
    throw new Error(`Invalid mobile number format: ${cleanMobile}. Must be exactly 9 digits.`);
  }

  const payload = {
    mobile_money_operator_ref_id: operatorId,
    mobile: cleanMobile,
    amount: amountMWK.toString(),
    currency: "MWK",
    reason: "Coach withdrawal payout",
    charge_id: `WD-${withdrawal.id}`,
  };

  console.log('Payout payload:', JSON.stringify(payload, null, 2));

  const resp = await fetch("https://api.paychangu.com/mobile-money/payouts/initialize", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${payChanguSecret}`,
    },
    body: JSON.stringify(payload),
  });

  console.log('Payout API response status:', resp.status);

  const result = await resp.json();
  console.log('Payout API response:', JSON.stringify(result, null, 2));

  if (!resp.ok || result.status !== "success" || result.data?.transaction?.status !== "success") {
    console.error("PayChangu payout error:", result);
    throw new Error("Failed to execute payout");
  }

  return result.data;
}

async function finalizeWithdrawal(
  supabase: any,
  userId: string,
  withdrawalRequest: any,
  creditsToDeduct: number,
  walletBalance: number,
  payoutData: any,
  payment_method: string,
  amountMWK: number
) {
  const newBalance = walletBalance - creditsToDeduct;

  // Deduct credits
  const { error: updateError } = await supabase
    .from("credit_wallets")
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (updateError) {
    console.error("Failed to update wallet balance:", updateError);
    throw new Error("Failed to update wallet balance");
  }

  // Record transaction
  const { error: transactionError } = await supabase.from("credit_transactions").insert({
    user_id: userId,
    transaction_type: "withdrawal",
    amount: -creditsToDeduct,
    balance_before: walletBalance,
    balance_after: newBalance,
    reference_type: "withdrawal_request",
    reference_id: withdrawalRequest.id,
    description: `Immediate withdrawal: ${creditsToDeduct} credits → ${amountMWK} MWK via PayChangu`,
    metadata: {
      payment_method,
      amount_mwk: amountMWK,
      payout_ref: payoutData.ref_id,
      payout_trans_id: payoutData.trans_id,
    },
  });

  if (transactionError) {
    console.error("Failed to record transaction:", transactionError);
    throw new Error("Failed to record transaction");
  }

  // Update withdrawal status
  const { error: withdrawalError } = await supabase
    .from("withdrawal_requests")
    .update({
      status: "completed",
      processed_at: new Date().toISOString(),
      processed_by: userId,
    })
    .eq("id", withdrawalRequest.id);

  if (withdrawalError) {
    console.error("Failed to update withdrawal status:", withdrawalError);
    throw new Error("Failed to update withdrawal status");
  }

  return newBalance;
}

/** ---------- Main Server ---------- **/

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST")
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const payChanguSecret = Deno.env.get("PAYCHANGU_SECRET_KEY");

    if (!supabaseUrl || !supabaseKey || !payChanguSecret)
      throw new Error("Missing configuration");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const user = await authenticateUser(supabase, token);

    // Role check
    await verifyCoachRole(supabase, user.id);

    // Body validation
    const body = await req.json();
    const { creditsToWithdraw, payment_method, payment_details } =
      validateRequestBody(body);

    // Wallet & balance
    const walletBalance = await getWalletBalance(supabase, user.id);
    if (walletBalance < creditsToWithdraw) throw new Error("Insufficient balance");

    // Convert credits → MWK
    const amountMWK = creditsToWithdraw * 100;

    // Create withdrawal request
    const withdrawalRequest = await createWithdrawalRequest(
      supabase,
      user.id,
      creditsToWithdraw,
      amountMWK,
      payment_method,
      payment_details,
      body.notes
    );

    // Operator & payout
    const operatorId = await getOperatorId(payChanguSecret, payment_details.mobile);
    const payoutData = await executePayout(
      payChanguSecret,
      withdrawalRequest,
      payment_details,
      operatorId,
      amountMWK
    );

    // Finalize withdrawal
    const newBalance = await finalizeWithdrawal(
      supabase,
      user.id,
      withdrawalRequest,
      creditsToWithdraw,
      walletBalance,
      payoutData,
      payment_method,
      amountMWK
    );

    return new Response(
      JSON.stringify({
        success: true,
        withdrawal_request_id: withdrawalRequest.id,
        credits_amount: creditsToWithdraw,
        amount_mwk: amountMWK,
        payout_ref: payoutData.ref_id,
        payout_trans_id: payoutData.trans_id,
        new_balance: newBalance,
        message: "Withdrawal executed successfully.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("Immediate withdrawal error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
