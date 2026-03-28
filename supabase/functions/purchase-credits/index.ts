// @ts-ignore: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { logRateLimitHit, logHighValueTransaction, createLogEntry } from "../_shared/monitoring.ts";
import { requestToPay } from "../_shared/onekhusa.ts";

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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const isDebug = (Deno.env.get("APP_ENV") ?? "production") !== "production";
    if (isDebug) {
      console.log("Environment variables:");
      console.log("- SUPABASE_URL:", supabaseUrl ? "SET" : "NOT SET");
      console.log("- SUPABASE_SERVICE_ROLE_KEY:", supabaseKey ? "SET" : "NOT SET");
    }

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing required environment variables");
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

    // Parse request body
    const body = await req.json();
    const { package_id } = body;

    if (!package_id) {
      return new Response(JSON.stringify({ error: "package_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 🔒 SECURITY: Rate limiting on purchases (10 per hour)
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count: purchaseCount, error: rlError } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("transaction_mode", "credit_purchase")
      .gte("created_at", oneHourAgo);
    
    if (rlError) {
      // Fail closed or degrade gracefully based on your policy
      console.error("Rate-limit check failed:", rlError.message);
      // For security, fail closed on rate limit errors
      await logRateLimitHit(user.id, "credit_purchase", 10, 0);
      return new Response(JSON.stringify({ 
        error: "Service temporarily unavailable. Please try again later." 
      }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    if ((purchaseCount || 0) >= 10) {
      await logRateLimitHit(user.id, "credit_purchase", 10, purchaseCount || 0);
      return new Response(JSON.stringify({ 
        error: "Too many purchase attempts. Please try again later." 
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (isDebug) {
      console.log(`✓ Purchase rate limit check passed (${purchaseCount || 0}/10 in last hour)`);
    }

    // Fetch credit package
    const { data: creditPackage, error: packageError } = await supabase
      .from("credit_packages")
      .select("*")
      .eq("id", package_id)
      .eq("is_active", true)
      .single();

    if (packageError || !creditPackage) {
      return new Response(JSON.stringify({ error: "Credit package not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 🔒 SECURITY: Fraud detection for large purchases
    const totalCredits = Number(creditPackage.credits) + Number(creditPackage.bonus_credits || 0);
    
    // Check if this is first purchase of large amount
    const { data: pastSuccessful } = await supabase
      .from("transactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("transaction_mode", "credit_purchase")
      .eq("status", "success")
      .limit(1);
    
    const isFirstPurchase = !pastSuccessful || pastSuccessful.length === 0;
    
    if (isFirstPurchase && totalCredits > 1000) {
      if (isDebug) {
        createLogEntry('warn', 'purchase-credits', 'Large first purchase flagged', {
          user_id: user.id,
          credits: totalCredits,
          amount: creditPackage.price_mwk,
        });
      }
      // Log for monitoring, but allow the purchase
      // In production, you might want to require additional verification
    }

    // Calculate payment amount in MWK
    const amount = creditPackage.price_mwk;

    // Generate unique transaction reference
    const tx_ref = crypto.randomUUID();

    // Create pending transaction record
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        transaction_ref: tx_ref,
        amount: amount,
        currency: "MWK",
        status: "pending",
        transaction_mode: "credit_purchase",
        credit_package_id: package_id,
        credits_amount: totalCredits,
      })
      .select()
      .single();

    if (txError || !transaction) {
      throw new Error("Failed to create transaction: " + txError?.message);
    }

    // Log high-value transactions
    await logHighValueTransaction('purchase', user.id, totalCredits, amount);

    // Call OneKhusa Request-To-Pay API
    if (isDebug) {
      console.log("About to call OneKhusa API for credit purchase");
      console.log("Request-to-pay payload (redacted):", JSON.stringify({
        merchantAccountNumber: "<configured>",
        transactionAmount: amount,
        transactionDescription: `Purchase ${creditPackage.name} (${totalCredits} credits)`,
        referenceNumber: tx_ref,
      }, null, 2));
    }

    const { resp: onekhusaResponse, data: onekhusaData } = await requestToPay({
      amount,
      referenceNumber: tx_ref,
      description: `Purchase ${creditPackage.name} (${totalCredits} credits)`,
      idempotencyKey: tx_ref,
    });
    if (isDebug) {
      console.log("OneKhusa response status:", onekhusaResponse.status);
      console.log("OneKhusa response received for tx_ref", tx_ref);
    }

    if (!onekhusaResponse.ok || !onekhusaData?.timedAccountNumber) {
      // Update transaction to failed
      await supabase
        .from("transactions")
        .update({ status: "failed", gateway_response: onekhusaData })
        .eq("id", transaction.id);

      return new Response(JSON.stringify({
        error: "Failed to initialize payment",
        details: {
          provider: "OneKhusa",
          responseStatus: onekhusaResponse.status,
        },
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        checkout_url: null,
        payment_channel: "onekhusa_tan",
        timed_account_number: onekhusaData.timedAccountNumber,
        expires_at: onekhusaData.expiryDate,
        expires_in_minutes: onekhusaData.expiryInMinutes,
        transaction_ref: tx_ref,
        credits_amount: totalCredits,
        package_name: creditPackage.name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    createLogEntry('error', 'purchase-credits', `Purchase credits error: ${msg}`, {
      error: msg,
      stack: e instanceof Error ? e.stack : undefined,
    });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
