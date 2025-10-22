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
  "Access-Control-Allow-Origin": Deno.env.get('ALLOWED_ORIGINS') || 'http://localhost:5173',
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, signature",
  "Access-Control-Allow-Methods": "OPTIONS, GET, POST",
  "Access-Control-Max-Age": "86400",
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function verifySignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const secret = Deno.env.get("PAYCHANGU_WEBHOOK_SECRET");
  if (!secret || !signatureHeader) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const computedHex = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
  const providedHex = signatureHeader.trim().toLowerCase();
  return timingSafeEqual(computedHex, providedHex);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Handle GET requests (return URL redirect)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const txRef = url.searchParams.get('tx_ref');

    if (txRef) {
      const appBaseUrl = Deno.env.get("APP_BASE_URL") || "http://localhost:5173";
      const redirectUrl = `${appBaseUrl}/client/credits/success?tx_ref=${txRef}`;
      return Response.redirect(redirectUrl, 302);
    }

    return new Response(JSON.stringify({ status: "ok", message: "Credits webhook endpoint is active" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("Signature") || req.headers.get("signature");

  // Verify signature
  if (!Deno.env.get("PAYCHANGU_WEBHOOK_SECRET") || !signature) {
    return new Response(JSON.stringify({ error: "Missing signature or secret" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const valid = await verifySignature(rawBody, signature);
  if (!valid) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase configuration");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const status = payload.data?.status || payload.status;
    const tx_ref = payload.data?.tx_ref;

    if (!tx_ref) throw new Error("Missing tx_ref in webhook payload");

    console.log("Processing credit purchase webhook:", tx_ref, "Status:", status);

    // Find transaction
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("*")
      .eq("transaction_ref", tx_ref)
      .single();

    if (txErr || !tx) throw new Error("Transaction not found");

    // Check if already processed
    if (tx.status === "success") {
      console.log("Transaction already processed:", tx_ref);
      return new Response(JSON.stringify({ received: true, message: "Already processed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const success = status === "successful" || status === "success" || status === "completed";
    console.log("Payment success status:", success);

    // Update transaction
    await supabase
      .from("transactions")
      .update({ status: success ? "success" : "failed", gateway_response: payload })
      .eq("id", tx.id);

    if (success && tx.transaction_mode === "credit_purchase") {
      console.log("Processing credit purchase for user:", tx.user_id);
      console.log("Credits amount:", tx.credits_amount);

      // Get user's wallet
      const { data: wallet, error: walletErr } = await supabase
        .from("credit_wallets")
        .select("*")
        .eq("user_id", tx.user_id)
        .single();

      if (walletErr) {
        console.error("Wallet error:", walletErr);
        throw new Error("Wallet not found");
      }

      const creditsToAdd = Number(tx.credits_amount);
      const balanceBefore = Number(wallet.balance);
      const balanceAfter = balanceBefore + creditsToAdd;

      // Update wallet balance
      const { error: updateErr } = await supabase
        .from("credit_wallets")
        .update({
          balance: balanceAfter,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", tx.user_id);

      if (updateErr) {
        console.error("Failed to update wallet:", updateErr);
        throw new Error("Failed to update wallet balance");
      }

      // Create credit transaction record
      const { error: creditTxErr } = await supabase
        .from("credit_transactions")
        .insert({
          user_id: tx.user_id,
          transaction_type: "purchase",
          amount: creditsToAdd,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          reference_type: "transaction",
          reference_id: tx.id,
          description: `Purchased ${creditsToAdd} credits`,
          metadata: {
            package_id: tx.credit_package_id,
            transaction_ref: tx_ref,
          },
        });

      if (creditTxErr) {
        console.error("Failed to create credit transaction:", creditTxErr);
        throw new Error("Failed to log credit transaction");
      }

      console.log("Successfully added credits to wallet:", creditsToAdd);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("Error in credits-webhook:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
