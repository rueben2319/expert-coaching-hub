// @ts-ignore: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { sendAlert, sendFraudAlert, logHighValueTransaction, logRateLimitHit } from "../_shared/monitoring.ts";

// Minimal Deno type declaration for environment access
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
      if (/^(99|9)/.test(cleanNumber)) {
        return 'AIRTEL_MW';
      } else if (/^(88|8)/.test(cleanNumber)) {
        return 'TNM_MW';
      } else {
        throw new Error('Unsupported mobile number prefix');
      }
    }

    const operatorsData = await operatorsResponse.json();
    const operatorsList = operatorsData.data ?? [];

    let operatorName = '';
    if (/^(99|9)/.test(cleanNumber)) operatorName = 'Airtel';
    else if (/^(88|8)/.test(cleanNumber)) operatorName = 'TNM';
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

const MAX_WITHDRAWAL = parseInt(Deno.env.get('MAX_WITHDRAWAL') || '10000', 10);
const MIN_WITHDRAWAL = parseInt(Deno.env.get('MIN_WITHDRAWAL') || '10', 10);
const DAILY_LIMIT = parseInt(Deno.env.get('DAILY_WITHDRAWAL_LIMIT') || '50000', 10);
const CREDIT_AGING_DAYS = parseInt(Deno.env.get('CREDIT_AGING_DAYS') || '3', 10);
const RATE_LIMIT_PER_HOUR = parseInt(Deno.env.get('RATE_LIMIT_PER_HOUR') || '5', 10);

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
    if (!/^(99|9|88|8)\d{7}$/.test(cleanNumber)) {
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

  const redacted = { ...payload, mobile: payload.mobile.replace(/\d(?=\d{2}$)/g, "•") };
  console.log('Payout payload:', JSON.stringify(redacted, null, 2));

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

  // Handle different PayChangu response scenarios
  if (!resp.ok) {
    console.error("PayChangu API error:", resp.status, result);
    const errorMsg = result.message || result.error || "Payment provider unavailable";
    throw new Error(`Payout failed: ${errorMsg}`);
  }

  // Check transaction status
  const txStatus = result.data?.transaction?.status;
  
  if (result.status === "success" && txStatus === "success") {
    return result.data;
  }
  
  // Handle pending status (PayChangu may process asynchronously)
  if (txStatus === "pending" || txStatus === "processing") {
    console.warn("PayChangu payout is pending:", result);
    return {
      ...result.data,
      _pending: true,
    };
  }
  
  // Handle explicit failure
  if (txStatus === "failed" || result.status === "failed") {
    const reason = result.data?.transaction?.failure_reason || result.message || "Unknown error";
    throw new Error(`Payout rejected: ${reason}`);
  }
  
  // Unknown status - treat as error
  console.error("Unexpected PayChangu response:", result);
  throw new Error("Payout status unclear. Contact support if funds were deducted.");
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
  // Atomic withdrawal processing using PostgreSQL function
  const { data, error } = await supabase.rpc('process_withdrawal', {
    coach_id: userId,
    credits_amount: creditsToDeduct,
    amount_mwk: amountMWK,
    withdrawal_id: withdrawalRequest.id,
    payout_ref: payoutData.transaction?.ref_id,
    payout_trans_id: payoutData.transaction?.trans_id,
    payment_method: payment_method,
  });

  if (error) {
    console.error("Failed to process withdrawal atomically:", error);
    throw new Error("Failed to complete withdrawal: " + error.message);
  }

  return data.new_balance;
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
  
  if (withdrawalCount >= RATE_LIMIT_PER_HOUR) {
    // Log rate limit hit
    await logRateLimitHit(userId, "withdrawal", RATE_LIMIT_PER_HOUR, withdrawalCount);
    throw new Error(`Rate limit exceeded. Maximum ${RATE_LIMIT_PER_HOUR} withdrawal requests per hour. Please try again later.`);
  }
  
  return withdrawalCount;
}

async function checkDailyLimit(supabase: any, userId: string, requestedAmount: number) {
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
  
  const { data: todayWithdrawals, error } = await supabase
    .from("withdrawal_requests")
    .select("credits_amount")
    .eq("coach_id", userId)
    .in("status", ["completed", "processing"])
    .gte("created_at", oneDayAgo);
  
  if (error) {
    console.error("Daily limit check error:", error);
    // Fail closed for security - block withdrawal on rate limit errors
    throw new Error("Service temporarily unavailable. Please try again later.");
  }
  
  const totalToday = todayWithdrawals?.reduce((sum: number, w: any) => sum + Number(w.credits_amount), 0) || 0;
  
  if (totalToday + requestedAmount > DAILY_LIMIT) {
    throw new Error(`Daily withdrawal limit exceeded. You have withdrawn ${totalToday} credits today. Daily limit: ${DAILY_LIMIT} credits.`);
  }
  
  return totalToday;
}

async function checkCreditAge(supabase: any, userId: string, requestedAmount: number) {
  // Get current balance first
  const { data: wallet, error: walletError } = await supabase
    .from("credit_wallets")
    .select("balance")
    .eq("user_id", userId)
    .single();

  if (walletError || !wallet) {
    console.error("Credit age check - wallet error:", walletError);
    throw new Error("Service temporarily unavailable. Please try again later.");
  }

  const currentBalance = Number(wallet.balance);

  // Call database function to calculate available withdrawable credits
  const { data: availableCredits, error: rpcError } = await supabase.rpc('get_available_withdrawable_credits', {
    user_id_param: userId,
    credit_aging_days_param: CREDIT_AGING_DAYS
  });

  if (rpcError) {
    console.error("Credit age check - RPC error:", rpcError);
    throw new Error("Service temporarily unavailable. Please try again later.");
  }

  // Clamp result between 0 and current balance for safety
  const clampedAvailableCredits = Math.min(Math.max(Number(availableCredits), 0), currentBalance);

  if (requestedAmount > clampedAvailableCredits) {
    const recentCredits = Math.max(0, currentBalance - clampedAvailableCredits);
    throw new Error(
      `Only ${clampedAvailableCredits.toFixed(2)} credits are available for withdrawal. ` +
      `${recentCredits.toFixed(2)} credits are too recent (must age ${CREDIT_AGING_DAYS} days).`
    );
  }

  return clampedAvailableCredits;
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
  
  // Large withdrawal (> MAX_WITHDRAWAL credits)
  if (amount > MAX_WITHDRAWAL) {
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

serve(async (req: Request) => {
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
    
    const walletBalance = await getWalletBalance(supabase, user.id);
    if (walletBalance < creditsToWithdraw) throw new Error("Insufficient balance");

    // Convert credits → MWK (needed for logging)
    // Use environment variable for conversion rate, fallback to 100 if not set
    const CREDIT_TO_MWK_RATE = parseFloat(Deno.env.get('CREDIT_TO_MWK_RATE') || '100');
    const amountMWK = Math.round(creditsToWithdraw * CREDIT_TO_MWK_RATE);

    // Log high-value transactions
    await logHighValueTransaction('withdrawal', user.id, creditsToWithdraw, amountMWK);

    // ✅ IDEMPOTENCY CHECK: Prevent duplicate withdrawals
    // Check if there's a recent processing withdrawal with same amount to same phone
    const { data: recentWithdrawals } = await supabase
      .from("withdrawal_requests")
      .select("id, status, transaction_ref, created_at")
      .eq("coach_id", user.id)
      .eq("credits_amount", creditsToWithdraw)
      .in("status", ["processing", "completed"])
      .gte("created_at", new Date(Date.now() - 60000).toISOString()); // Last 60 seconds
    
    if (recentWithdrawals && recentWithdrawals.length > 0) {
      const recent = recentWithdrawals[0];
      console.warn(`⚠️ DUPLICATE WITHDRAWAL ATTEMPT DETECTED`, {
        user_id: user.id,
        amount: creditsToWithdraw,
        existing_withdrawal_id: recent.id,
        existing_status: recent.status,
        existing_transaction_ref: recent.transaction_ref,
      });
      
      // Return the existing withdrawal instead of creating a duplicate
      return new Response(
        JSON.stringify({
          success: true,
          duplicate: true,
          withdrawal_request_id: recent.id,
          status: recent.status,
          transaction_ref: recent.transaction_ref,
          message: "A withdrawal with this amount was just processed. Returning existing withdrawal.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null,
        user_agent: req.headers.get("user-agent") || null,
        retry_count: 0,
        original_withdrawal_id: body.original_withdrawal_id || null,
      })
      .select()
      .single();
    
    if (withdrawalError || !withdrawalRequest) {
      throw new Error("Failed to create withdrawal request");
    }

    // Operator & payout
    const operatorId = await getOperatorId(payChanguSecret, payment_details.mobile);
    let payoutData;
    let payoutError: Error | null = null;
    
    try {
      payoutData = await executePayout(
        payChanguSecret,
        withdrawalRequest,
        payment_details,
        operatorId,
        amountMWK
      );
      
      // ✅ CRITICAL: Store transaction ID immediately after PayChangu response
      // This prevents duplicate withdrawals and ensures we can track the transaction
      const transactionRef = payoutData.transaction?.trans_id || payoutData.transaction?.ref_id;
      if (transactionRef) {
        console.log(`✓ Storing transaction reference: ${transactionRef}`);
        await supabase
          .from("withdrawal_requests")
          .update({
            transaction_ref: transactionRef,
          })
          .eq("id", withdrawalRequest.id);
      }
    } catch (err) {
      payoutError = err instanceof Error ? err : new Error(String(err));
      console.error("Payout execution failed:", payoutError);
      
      // Mark withdrawal as failed with detailed error
      await supabase
        .from("withdrawal_requests")
        .update({
          status: "failed",
          processed_at: new Date().toISOString(),
          processed_by: user.id,
          rejection_reason: payoutError.message,
        })
        .eq("id", withdrawalRequest.id);

      // Attempt automatic refund
      console.log("Attempting automatic refund...");
      const { error: refundError } = await supabase.rpc('refund_failed_withdrawal', {
        coach_id: user.id,
        credits_amount: creditsToWithdraw,
        withdrawal_id: withdrawalRequest.id,
      });

      if (refundError) {
        console.error("CRITICAL: Failed to refund credits:", refundError);
        
        // Send critical alert - manual intervention needed
        await sendAlert({
          level: 'critical',
          title: 'Failed Withdrawal Refund Error',
          message: `Failed to refund ${creditsToWithdraw} credits to user ${user.id} after payout failure`,
          metadata: {
            user_id: user.id,
            withdrawal_id: withdrawalRequest.id,
            credits_amount: creditsToWithdraw,
            payout_error: payoutError.message,
            refund_error: refundError.message,
          },
          user_id: user.id,
        });
        
        throw new Error(
          "Withdrawal failed and automatic refund failed. " +
          "Support has been notified and will process your refund manually within 24 hours. " +
          `Reference: ${withdrawalRequest.id}`
        );
      }
      
      console.log("✓ Refund successful");
      
      // Throw user-friendly error
      throw new Error(
        `Withdrawal failed: ${payoutError.message}. ` +
        "Your credits have been automatically refunded to your wallet."
      );
    }

    // Handle pending payouts differently
    const isPending = payoutData._pending === true;
    let newBalance: number;
    
    if (isPending) {
      // Mark as processing, don't deduct credits yet
      await supabase
        .from("withdrawal_requests")
        .update({
          status: "processing",
          notes: "Payout pending with payment provider. Credits will be deducted upon confirmation.",
        })
        .eq("id", withdrawalRequest.id);
      
      console.log("⏳ Payout pending - awaiting webhook confirmation");
      
      return new Response(
        JSON.stringify({
          success: true,
          pending: true,
          withdrawal_request_id: withdrawalRequest.id,
          credits_amount: creditsToWithdraw,
          amount_mwk: amountMWK,
          message: "Withdrawal is being processed. You'll receive confirmation shortly.",
        }),
        { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Finalize successful payout
    try {
      newBalance = await finalizeWithdrawal(
        supabase,
        user.id,
        withdrawalRequest,
        creditsToWithdraw,
        walletBalance,
        payoutData,
        payment_method,
        amountMWK
      );
    } catch (finalizationError) {
      console.error("CRITICAL: Payout succeeded but finalization failed:", finalizationError);
      
      // This is a critical state - payout went through but DB not updated
      await sendAlert({
        level: 'critical',
        title: 'Withdrawal Finalization Error',
        message: `Payout succeeded but DB update failed for user ${user.id}`,
        metadata: {
          user_id: user.id,
          withdrawal_id: withdrawalRequest.id,
          credits_amount: creditsToWithdraw,
          payout_ref: payoutData.transaction?.ref_id,
          error: finalizationError instanceof Error ? finalizationError.message : String(finalizationError),
        },
        user_id: user.id,
      });
      
      throw new Error(
        "Payout was successful but we couldn't update your balance. " +
        "Support has been notified and will resolve this within 24 hours. " +
        `Reference: ${withdrawalRequest.id}`
      );
    }

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
