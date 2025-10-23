// @ts-ignore: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
// @ts-ignore: Deno imports work at runtime
import { sendAlert, sendFraudAlert, logHighValueTransaction, logRateLimitHit } from "../_shared/monitoring.ts";

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
    const cleanNumber = phoneNumber.replace(/^\+?265/, '');

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
        return 'AIRTEL_MW';
      } else if (/^(77|76)/.test(cleanNumber)) {
        return 'TNM_MW';
      } else {
        throw new Error('Unsupported mobile number prefix');
      }
    }

    const operatorsData = await operatorsResponse.json();
    const operatorsList = operatorsData.data ?? [];

    let operatorName = '';
    if (/^(99|88)/.test(cleanNumber)) operatorName = 'Airtel';
    else if (/^(77|76)/.test(cleanNumber)) operatorName = 'TNM';
    else throw new Error('Unsupported mobile number prefix');

    let foundOperator: any = null;
    for (const op of operatorsList) {
      if (!op || !op.name || !op.supported_country || !op.supported_country.name) {
        continue;
      }
      const nameMatch = op.name.toLowerCase().includes(operatorName.toLowerCase());
      const countryMatch = op.supported_country.name.toLowerCase() === 'malawi';
      if (nameMatch && countryMatch) {
        foundOperator = op;
        break;
      }
    }

    if (foundOperator) {
      return foundOperator.ref_id;
    }

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

const MAX_WITHDRAWAL = 100000; // Maximum withdrawal limit
const MIN_WITHDRAWAL = 10; // Minimum withdrawal amount

function validateRequestBody(body: any) {
  const { credits_amount, payment_method, payment_details } = body;
  if (!credits_amount || !payment_method || !payment_details) {
    const missing = ["credits_amount", "payment_method", "payment_details"].filter(
      (k) => !body[k]
    );
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }

  const creditsNum = Number(credits_amount);
  
  // Comprehensive validation
  if (isNaN(creditsNum)) {
    throw new Error("Amount must be a valid number");
  }
  
  if (creditsNum <= 0) {
    throw new Error("Amount must be positive");
  }
  
  if (creditsNum < MIN_WITHDRAWAL) {
    throw new Error(`Minimum withdrawal is ${MIN_WITHDRAWAL} credits`);
  }
  
  if (creditsNum > MAX_WITHDRAWAL) {
    throw new Error(`Maximum withdrawal is ${MAX_WITHDRAWAL} credits`);
  }
  
  if (!Number.isInteger(creditsNum)) {
    throw new Error("Amount must be a whole number (no decimals)");
  }

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

/** ---------- Security & Rate Limiting ---------- **/

async function checkRateLimit(supabase: any, userId: string) {
  // Check withdrawals in last hour
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  
  const { data: recentWithdrawals, error } = await supabase
    .from("withdrawal_requests")
    .select("id")
    .eq("coach_id", userId)
    .gte("created_at", oneHourAgo);
  
  if (error) {
    console.error("Rate limit check error:", error);
    return; // Don't block on error
  }
  
  const withdrawalCount = recentWithdrawals?.length || 0;
  
  if (withdrawalCount >= 5) {
    // Log rate limit hit
    await logRateLimitHit(userId, "withdrawal", 5, withdrawalCount);
    throw new Error("Rate limit exceeded. Maximum 5 withdrawal requests per hour. Please try again later.");
  }
  
  return withdrawalCount;
}

async function checkDailyLimit(supabase: any, userId: string, requestedAmount: number) {
  const DAILY_LIMIT = 50000; // 50k credits per day
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
  
  const { data: todayWithdrawals, error } = await supabase
    .from("withdrawal_requests")
    .select("credits_amount")
    .eq("coach_id", userId)
    .in("status", ["completed", "processing"])
    .gte("created_at", oneDayAgo);
  
  if (error) {
    console.error("Daily limit check error:", error);
    return; // Don't block on error
  }
  
  const totalToday = todayWithdrawals?.reduce((sum, w) => sum + Number(w.credits_amount), 0) || 0;
  
  if (totalToday + requestedAmount > DAILY_LIMIT) {
    throw new Error(`Daily withdrawal limit exceeded. You have withdrawn ${totalToday} credits today. Daily limit: ${DAILY_LIMIT} credits.`);
  }
  
  return totalToday;
}

async function checkCreditAge(supabase: any, userId: string, requestedAmount: number) {
  const CREDIT_AGING_DAYS = 3;
  const agingDate = new Date(Date.now() - (CREDIT_AGING_DAYS * 86400000)).toISOString();
  
  // Get credits earned before the aging period
  const { data: agedTransactions, error } = await supabase
    .from("credit_transactions")
    .select("amount")
    .eq("user_id", userId)
    .in("transaction_type", ["purchase", "course_earning", "refund"])
    .lte("created_at", agingDate);
  
  if (error) {
    console.error("Credit age check error:", error);
    return; // Don't block on error
  }
  
  const agedCredits = agedTransactions?.reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;
  
  // Get current balance
  const { data: wallet } = await supabase
    .from("credit_wallets")
    .select("balance")
    .eq("user_id", userId)
    .single();
  
  const currentBalance = Number(wallet?.balance || 0);
  const recentCredits = Math.max(0, currentBalance - agedCredits);
  const availableForWithdrawal = agedCredits;
  
  if (requestedAmount > availableForWithdrawal) {
    throw new Error(
      `Only ${availableForWithdrawal.toFixed(2)} credits are available for withdrawal. ` +
      `${recentCredits.toFixed(2)} credits are too recent (must age ${CREDIT_AGING_DAYS} days).`
    );
  }
  
  return availableForWithdrawal;
}

async function calculateFraudScore(supabase: any, userId: string, amount: number) {
  let score = 0;
  let reasons = [];
  
  // Check account age
  const { data: profile } = await supabase
    .from("profiles")
    .select("created_at")
    .eq("id", userId)
    .single();
  
  if (profile) {
    const accountAgeDays = Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000);
    
    // New account (< 7 days)
    if (accountAgeDays < 7) {
      score += 20;
      reasons.push(`New account (${accountAgeDays} days old)`);
    }
  }
  
  // Check for rapid buy-withdraw pattern
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const { data: recentPurchases } = await supabase
    .from("credit_transactions")
    .select("created_at, amount")
    .eq("user_id", userId)
    .eq("transaction_type", "purchase")
    .gte("created_at", oneHourAgo);
  
  if (recentPurchases && recentPurchases.length > 0) {
    score += 30;
    reasons.push("Rapid buy-withdraw pattern (< 1 hour)");
  }
  
  // Large withdrawal (> 10,000 credits = MWK 1M)
  if (amount > 10000) {
    score += 25;
    reasons.push(`Large withdrawal (${amount} credits)`);
  }
  
  // Check if this is first withdrawal
  const { data: pastWithdrawals } = await supabase
    .from("withdrawal_requests")
    .select("id")
    .eq("coach_id", userId)
    .eq("status", "completed");
  
  if (!pastWithdrawals || pastWithdrawals.length === 0) {
    if (amount > 5000) {
      score += 20;
      reasons.push("First withdrawal with large amount");
    }
  }
  
  return { score, reasons };
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

    // 🔒 SECURITY CHECKS (NEW)
    
    // 1. Rate limiting (5 requests per hour)
    await checkRateLimit(supabase, user.id);
    console.log("✓ Rate limit check passed");
    
    // 2. Daily withdrawal limit (50k credits)
    const todayTotal = await checkDailyLimit(supabase, user.id, creditsToWithdraw);
    console.log(`✓ Daily limit check passed (${todayTotal} used today)`);
    
    // 3. Credit aging (3-day cooldown)
    const availableCredits = await checkCreditAge(supabase, user.id, creditsToWithdraw);
    console.log(`✓ Credit age check passed (${availableCredits} available)`);
    
    // 4. Fraud detection
    const fraudCheck = await calculateFraudScore(supabase, user.id, creditsToWithdraw);
    console.log(`✓ Fraud score: ${fraudCheck.score}/100`, fraudCheck.reasons);
    
    // Flag high-risk transactions for manual review
    const HIGH_RISK_THRESHOLD = 50;
    if (fraudCheck.score >= HIGH_RISK_THRESHOLD) {
      console.warn(`⚠️ HIGH RISK WITHDRAWAL FLAGGED`, {
        user_id: user.id,
        amount: creditsToWithdraw,
        score: fraudCheck.score,
        reasons: fraudCheck.reasons,
      });
      
      // Send fraud alert
      await sendFraudAlert({
        level: fraudCheck.score >= 75 ? 'critical' : 'warning',
        title: 'High-Risk Withdrawal Detected',
        message: `Withdrawal of ${creditsToWithdraw} credits flagged with score ${fraudCheck.score}/100`,
        fraud_score: fraudCheck.score,
        fraud_reasons: fraudCheck.reasons,
        amount: creditsToWithdraw,
        transaction_type: 'withdrawal',
        user_id: user.id,
      });
      
      // Optionally block very high scores
      if (fraudCheck.score >= 75) {
        throw new Error(
          "This withdrawal has been flagged for manual review due to unusual activity. " +
          "Please contact support for assistance."
        );
      }
    }
    
    // Log high-value transactions
    await logHighValueTransaction('withdrawal', user.id, creditsToWithdraw, amountMWK);

    // Wallet & balance
    const walletBalance = await getWalletBalance(supabase, user.id);
    if (walletBalance < creditsToWithdraw) throw new Error("Insufficient balance");

    // Convert credits → MWK
    const amountMWK = creditsToWithdraw * 100;

    // Create withdrawal request with fraud tracking
    const { data: withdrawalRequest, error: withdrawalError } = await supabase
      .from("withdrawal_requests")
      .insert({
        coach_id: user.id,
        credits_amount: creditsToWithdraw,
        amount: amountMWK,
        status: "processing",
        payment_method,
        payment_details,
        notes: body.notes || null,
        fraud_score: fraudCheck.score,
        fraud_reasons: fraudCheck.reasons,
      })
      .select()
      .single();
    
    if (withdrawalError || !withdrawalRequest) {
      throw new Error("Failed to create withdrawal request");
    }

    // Operator & payout
    const operatorId = await getOperatorId(payChanguSecret, payment_details.mobile);
    const payoutData = await executePayout(
      payChanguSecret,
      withdrawalRequest,
      payment_details,
      operatorId,
      amountMWK
    );

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
        payout_ref: payoutData.transaction.ref_id,
        payout_trans_id: payoutData.transaction.trans_id,
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
