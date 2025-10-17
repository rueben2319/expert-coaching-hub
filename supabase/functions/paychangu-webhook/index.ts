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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, signature",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
};

type WebhookPayload = {
  status: string;
  message?: string;
  data?: {
    tx_ref?: string;
    amount?: number;
    currency?: string;
    status?: string;
  };
};

function timingSafeEqual(a: string, b: string): boolean {
  // Constant-time compare for equal-length strings
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
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  let payload: WebhookPayload;
  const rawBody = await req.text();
  const signature = req.headers.get("Signature") || req.headers.get("signature");

  // Require secret and signature for all environments
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

  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase environment configuration");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const status = payload.data?.status || payload.status;
    const tx_ref = payload.data?.tx_ref;

    if (!tx_ref) throw new Error("Missing tx_ref in webhook payload");

    console.log("Webhook payload status:", status);
    console.log("Transaction ref:", tx_ref);

    // Find transaction
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("id, user_id, amount, currency, status, order_id, subscription_id, client_subscription_id")
      .eq("transaction_ref", tx_ref)
      .single();
    if (txErr || !tx) throw new Error("Transaction not found");

    const success = status === "successful" || status === "success" || status === "completed";
    console.log("Payment success status:", success);

    // Update transaction status and gateway response
    await (supabase.from("transactions") as any)
      .update({ status: success ? "success" : "failed", gateway_response: payload })
      .eq("id", tx.id);

    if (success) {
      // Update related records
      if (tx.subscription_id) {
        console.log("Updating coach subscription:", tx.subscription_id);
        // Activate coach subscription
        const now = new Date();
        // Fetch billing cycle to set renewal_date
        const { data: sub, error: subErr } = await supabase
          .from("coach_subscriptions")
          .select("id, billing_cycle")
          .eq("id", tx.subscription_id)
          .single();
        if (!subErr && sub) {
          console.log("Found subscription:", sub);
          const renewal = new Date(now);
          if (sub.billing_cycle === "yearly") renewal.setFullYear(now.getFullYear() + 1);
          else renewal.setMonth(now.getMonth() + 1);

          const updateData = {
            status: "active",
            renewal_date: renewal.toISOString(),
            transaction_id: tx.id,
            start_date: now.toISOString()
          };
          console.log("Updating subscription with:", updateData);

          const { error: updateErr } = await supabase
            .from("coach_subscriptions")
            .update(updateData)
            .eq("id", tx.subscription_id);

          if (updateErr) {
            console.error("Error updating subscription:", updateErr);
            throw new Error("Failed to update subscription status");
          } else {
            console.log("Successfully updated subscription to active");
          }

          // Create invoice
          const { data: invNum } = await supabase.rpc("generate_invoice_number");
          const invoiceData = {
            user_id: tx.user_id,
            amount: tx.amount,
            currency: tx.currency,
            invoice_number: invNum ?? `INV-${Date.now()}`,
            invoice_date: now.toISOString(),
            payment_method: "paychangu",
            description: "Coach subscription",
            status: "paid",
            subscription_id: tx.subscription_id,
            order_id: null,
          };
          console.log("Creating invoice:", invoiceData);

          const { error: invErr } = await supabase
            .from("invoices")
            .insert(invoiceData);

          if (invErr) {
            console.error("Error creating invoice:", invErr);
            // Don't throw here as subscription is already updated
          } else {
            console.log("Successfully created invoice");
          }
        } else {
          console.error("Subscription not found or error:", subErr);
        }
      }

      if (tx.order_id) {
        // Mark order paid
        const now = new Date();
        await (supabase.from("client_orders") as any)
          .update({ status: "paid", start_date: now.toISOString() })
          .eq("id", tx.order_id);

        const { data: invNum } = await supabase.rpc("generate_invoice_number");
        await (supabase.from("invoices") as any).insert({
          user_id: tx.user_id,
          amount: tx.amount,
          currency: tx.currency,
          invoice_number: invNum ?? `INV-${Date.now()}`,
          invoice_date: now.toISOString(),
          payment_method: "paychangu",
          description: "Order payment",
          status: "paid",
          order_id: tx.order_id,
          subscription_id: null,
        });
      }

      if (tx.client_subscription_id) {
        // Handle client subscription to coach package
        console.log("Activating client subscription:", tx.client_subscription_id);
        const now = new Date();

        // Get subscription details
        const { data: sub, error: subErr } = await supabase
          .from("client_subscriptions")
          .select("billing_cycle")
          .eq("id", tx.client_subscription_id)
          .single();

        if (!subErr && sub) {
          const renewal = new Date(now);
          if (sub.billing_cycle === "yearly") {
            renewal.setFullYear(now.getFullYear() + 1);
          } else {
            renewal.setMonth(now.getMonth() + 1);
          }

          const updateData = {
            status: "active",
            renewal_date: renewal.toISOString(),
            transaction_id: tx.id,
            start_date: now.toISOString()
          };
          console.log("Updating client subscription with:", updateData);

          const { error: updateErr } = await supabase
            .from("client_subscriptions")
            .update(updateData)
            .eq("id", tx.client_subscription_id);

          if (updateErr) {
            console.error("Error updating client subscription:", updateErr);
            throw new Error("Failed to update client subscription status");
          } else {
            console.log("Successfully activated client subscription");
          }

          // Create invoice
          const { data: invNum } = await supabase.rpc("generate_invoice_number");
          const invoiceData = {
            user_id: tx.user_id,
            amount: tx.amount,
            currency: tx.currency,
            invoice_number: invNum ?? `INV-${Date.now()}`,
            invoice_date: now.toISOString(),
            payment_method: "paychangu",
            description: "Coach package subscription",
            status: "paid",
            order_id: null,
            subscription_id: tx.client_subscription_id,
          };
          console.log("Creating invoice for client subscription:", invoiceData);

          const { error: invErr } = await supabase
            .from("invoices")
            .insert(invoiceData);

          if (invErr) {
            console.error("Error creating invoice for client subscription:", invErr);
            // Don't throw here as subscription is already updated
          } else {
            console.log("Successfully created invoice for client subscription");
          }
        } else {
          console.error("Client subscription not found or error:", subErr);
        }
      }
    }

    // Always return JSON for webhook acknowledgement
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
