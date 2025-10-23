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
    const paychanguSecretKey = Deno.env.get("PAYCHANGU_SECRET_KEY");
    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "http://localhost:8080";

    console.log("Environment variables:");
    console.log("- SUPABASE_URL:", supabaseUrl ? "SET" : "NOT SET");
    console.log("- SUPABASE_SERVICE_ROLE_KEY:", supabaseKey ? "SET" : "NOT SET");
    console.log("- PAYCHANGU_SECRET_KEY:", paychanguSecretKey ? "SET" : "NOT SET");
    console.log("- APP_BASE_URL:", appBaseUrl);

    if (!supabaseUrl || !supabaseKey || !paychanguSecretKey) {
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
    const { data: recentPurchases } = await supabase
      .from("transactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("transaction_mode", "credit_purchase")
      .gte("created_at", oneHourAgo);
    
    const purchaseCount = recentPurchases?.length || 0;
    if (purchaseCount >= 10) {
      console.warn(`⚠️ Purchase rate limit exceeded for user ${user.id}`);
      return new Response(JSON.stringify({ 
        error: "Too many purchase attempts. Please try again later." 
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(`✓ Purchase rate limit check passed (${purchaseCount}/10 in last hour)`);

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
      .eq("status", "success");
    
    const isFirstPurchase = !pastSuccessful || pastSuccessful.length === 0;
    
    if (isFirstPurchase && totalCredits > 1000) {
      console.warn(`⚠️ Large first purchase flagged`, {
        user_id: user.id,
        credits: totalCredits,
        amount: creditPackage.price_mwk,
      });
      // Log for monitoring, but allow the purchase
      // In production, you might want to require additional verification
    }

    // Calculate total credits (base + bonus)
    const totalCredits = Number(creditPackage.credits) + Number(creditPackage.bonus_credits || 0);
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

    // Call PayChangu API
    console.log("About to call PayChangu API for credit purchase");
    console.log("Payment payload:", JSON.stringify({
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
      }, null, 2));
    console.log("Using payment secret (first 10 chars):", paychanguSecretKey!.substring(0, 10) + "...");

    const paychanguResponse = await fetch("https://api.paychangu.com/payment", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${paychanguSecretKey!}`,
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

    console.log("PayChangu response status:", paychanguResponse.status);
    console.log("PayChangu response headers:", Object.fromEntries(paychanguResponse.headers.entries()));

    const paychanguData = await paychanguResponse.json();
    console.log("PayChangu response data:", JSON.stringify(paychanguData, null, 2));

    if (!paychanguResponse.ok || paychanguData.status !== "success") {
      // Update transaction to failed
      await supabase
        .from("transactions")
        .update({ status: "failed", gateway_response: paychanguData })
        .eq("id", transaction.id);

      return new Response(JSON.stringify({
        error: "Failed to initialize payment",
        details: paychanguData,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        checkout_url: paychanguData.data.checkout_url,
        transaction_ref: tx_ref,
        credits_amount: totalCredits,
        package_name: creditPackage.name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("Error in purchase-credits:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
