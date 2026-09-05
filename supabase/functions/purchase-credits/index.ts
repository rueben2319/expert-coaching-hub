// @ts-ignore: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { logRateLimitHit, logHighValueTransaction, createLogEntry } from "../_shared/monitoring.ts";
import { requestToPay } from "../_shared/onekhusa.ts";
import { getCorsHeaders, handleCorsPreflight, withCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimitPreset, RATE_LIMIT_PRESETS } from "../_shared/redis-rate-limit.ts";
import { circuitBreakers } from "../_shared/circuit-breaker.ts";

// Minimal Deno type declaration for environment access
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

serve(async (req: Request) => {
  const requestOrigin = req.headers.get("Origin");
  
  if (req.method === "OPTIONS") return handleCorsPreflight(requestOrigin);

  if (req.method !== "POST") {
    const errorResponse = new Response("Method Not Allowed", { status: 405 });
    return withCorsHeaders(errorResponse, requestOrigin);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const onekhusaSecretKey = Deno.env.get("ONEKHUSA_SECRET_KEY");
    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "http://localhost:8080";

    const isDebug = (Deno.env.get("APP_ENV") ?? "production") !== "production";
    if (isDebug) {
      console.log("Environment variables:");
      console.log("- SUPABASE_URL:", supabaseUrl ? "SET" : "NOT SET");
      console.log("- SUPABASE_SERVICE_ROLE_KEY:", supabaseKey ? "SET" : "NOT SET");
      console.log("- Payment gateway secret:", onekhusaSecretKey ? "SET" : "NOT SET");
      console.log("- APP_BASE_URL:", appBaseUrl);
    }

    if (!supabaseUrl || !supabaseKey || !onekhusaSecretKey) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      const errorResponse = new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
      return withCorsHeaders(errorResponse, requestOrigin);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      const errorResponse = new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
      return withCorsHeaders(errorResponse, requestOrigin);
    }

    // Parse request body
    const body = await req.json();
    const { package_id } = body;

    if (!package_id) {
      const errorResponse = new Response(JSON.stringify({ error: "package_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
      return withCorsHeaders(errorResponse, requestOrigin);
    }

    // 🔒 SECURITY: Rate limiting on purchases (10 per hour) using Redis
    try {
      const rateLimitResult = await checkRateLimitPreset(user.id, 'creditPurchase');
      
      if (!rateLimitResult.allowed) {
        await logRateLimitHit(user.id, "credit_purchase", rateLimitResult.limit, rateLimitResult.remaining);
        const errorResponse = new Response(JSON.stringify({ 
          error: `Too many purchase attempts. ${rateLimitResult.remaining} requests remaining. Please try again later.` 
        }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        });
        return withCorsHeaders(errorResponse, requestOrigin);
      }
      
      if (isDebug) {
        console.log(`✓ Purchase rate limit check passed (${rateLimitResult.remaining}/${rateLimitResult.limit} remaining)`);
      }
    } catch (redisError) {
      // Fallback to database-based rate limiting if Redis fails
      console.warn("Redis rate limiting failed, falling back to database:", redisError);
      
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const { count: purchaseCount, error: rlError } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("transaction_mode", "credit_purchase")
        .gte("created_at", oneHourAgo);
      
      if (rlError) {
        console.error("Rate-limit check failed:", rlError.message);
        await logRateLimitHit(user.id, "credit_purchase", 10, 0);
        const errorResponse = new Response(JSON.stringify({ 
          error: "Service temporarily unavailable. Please try again later." 
        }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
        return withCorsHeaders(errorResponse, requestOrigin);
      }
      
      if ((purchaseCount || 0) >= 10) {
        await logRateLimitHit(user.id, "credit_purchase", 10, purchaseCount || 0);
        const errorResponse = new Response(JSON.stringify({ 
          error: "Too many purchase attempts. Please try again later." 
        }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        });
        return withCorsHeaders(errorResponse, requestOrigin);
      }
      
      if (isDebug) {
        console.log(`✓ Purchase rate limit check passed (${purchaseCount || 0}/10 in last hour)`);
      }
    }

    // Fetch credit package
    const { data: creditPackage, error: packageError } = await supabase
      .from("credit_packages")
      .select("*")
      .eq("id", package_id)
      .eq("is_active", true)
      .single();

    if (packageError || !creditPackage) {
      const errorResponse = new Response(JSON.stringify({ error: "Credit package not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
      return withCorsHeaders(errorResponse, requestOrigin);
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

    // Call payment gateway API
    if (isDebug) {
      console.log("About to call payment gateway for credit purchase");
      console.log("Payment payload (redacted):", JSON.stringify({
          amount: String(amount),
          currency: "MWK",
          email: "<redacted>",
          first_name: user.user_metadata?.full_name?.split(' ')[0] || "User",
          last_name: user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || "",
          callback_url: `${supabaseUrl}/functions/v1/paychangu-webhook`,
          return_url: `${appBaseUrl}/client/credits/success?tx_ref=${tx_ref}`,
          tx_ref: tx_ref,
          customization: {
            title: `Purchase ${creditPackage.name}`,
            description: `${totalCredits} credits`,
          },
          meta: {
            mode: "credit_purchase",
            user_id: "<redacted>",
            package_id: package_id,
            credits_amount: totalCredits,
          },
        }, null, 2));
    }

    const onekhusaResponse = await circuitBreakers.onekhusa.execute(async () => {
      return await fetch("https://api.onekhusa.com/payment", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": `Bearer ${onekhusaSecretKey!}`,
        },
        body: JSON.stringify({
          amount: String(amount),
          currency: "MWK",
          email: user.email,
          first_name: user.user_metadata?.full_name?.split(' ')[0] || "User",
        last_name: user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || "",
        callback_url: `${supabaseUrl}/functions/v1/paychangu-webhook`,
        return_url: `${appBaseUrl}/client/credits/success?tx_ref=${tx_ref}`,
        tx_ref: tx_ref,
        customization: {
          title: `Purchase ${creditPackage.name}`,
          description: `${totalCredits} credits`,
        },
        meta: {
          mode: "credit_purchase",
          user_id: user.id,
          package_id: package_id,
          credits_amount: totalCredits,
        },
      }),
    });

    const onekhusaData = await onekhusaResponse.json();
    if (isDebug) {
      console.log("Payment gateway response status:", onekhusaResponse.status);
      console.log("Payment gateway response data:", JSON.stringify(onekhusaData, null, 2));
    }

    if (!onekhusaResponse.ok || onekhusaData.status !== "success") {
      // Update transaction to failed
      await supabase
        .from("transactions")
        .update({ status: "failed", gateway_response: onekhusaData })
        .eq("id", transaction.id);

      const errorResponse = new Response(JSON.stringify({
        error: "Failed to initialize payment",
        details: onekhusaData,
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
      return withCorsHeaders(errorResponse, requestOrigin);
    }

    const successResponse = new Response(
      JSON.stringify({
        checkout_url: onekhusaData.data.checkout_url,
        transaction_ref: tx_ref,
        credits_amount: totalCredits,
        package_name: creditPackage.name,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
    return withCorsHeaders(successResponse, requestOrigin);

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    createLogEntry('error', 'purchase-credits', `Purchase credits error: ${msg}`, {
      error: msg,
      stack: e instanceof Error ? e.stack : undefined,
    });
    const errorResponse = new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
    return withCorsHeaders(errorResponse, requestOrigin);
  }
});
