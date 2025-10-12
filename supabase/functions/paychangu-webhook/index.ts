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
  const computed = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
  return computed === signatureHeader.toLowerCase();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log("Webhook received - method:", req.method);

  let payload: WebhookPayload;
  let rawBody = "";

  if (req.method === "POST") {
    // Handle POST requests with JSON body
    rawBody = await req.text();
    const signature = req.headers.get("Signature");

    console.log("POST webhook - signature header present:", !!signature);
    console.log("Raw body length:", rawBody.length);

    // For development/testing, skip signature verification if secret is not set
    const webhookSecret = Deno.env.get("PAYCHANGU_WEBHOOK_SECRET");
    console.log("PAYCHANGU_WEBHOOK_SECRET set:", !!webhookSecret);

    if (webhookSecret) {
      console.log("Verifying signature...");
      const valid = await verifySignature(rawBody, signature);
      console.log("Signature valid:", valid);
      if (!valid) return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      console.log("PAYCHANGU_WEBHOOK_SECRET not set, skipping signature verification");
    }

    try {
      payload = JSON.parse(rawBody) as WebhookPayload;
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

  } else if (req.method === "GET") {
    // Handle GET requests with query parameters
    console.log("GET webhook - processing query parameters");
    const url = new URL(req.url);
    const tx_ref = url.searchParams.get("tx_ref");
    const status = url.searchParams.get("status") || "successful";

    if (!tx_ref) {
      return new Response(JSON.stringify({ error: "Missing tx_ref parameter" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create payload from query parameters
    payload = {
      status: status,
      data: {
        tx_ref: tx_ref,
        status: status
      }
    };

    console.log("GET webhook payload:", JSON.stringify(payload, null, 2));

  } else {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
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
      .select("id, user_id, amount, currency, status, order_id, subscription_id")
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

      if (tx.subscription_id && !tx.order_id) {
        // Handle client subscription to coach package
        console.log("Activating client subscription:", tx.subscription_id);
        const now = new Date();

        // Get subscription details
        const { data: sub, error: subErr } = await supabase
          .from("client_subscriptions")
          .select("billing_cycle")
          .eq("id", tx.subscription_id)
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
            .eq("id", tx.subscription_id);

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
            subscription_id: tx.subscription_id,
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

    // For successful payments, return HTTP redirect instead of HTML page
    if (success) {
      const appBaseUrl = Deno.env.get("APP_BASE_URL");
      if (appBaseUrl) {
        const redirectUrl = `${appBaseUrl}/coach/billing/success?tx_ref=${tx_ref}&status=successful`;
        console.log("Redirecting to:", redirectUrl);

        // Return HTTP 302 redirect instead of HTML page
        return new Response(null, {
          status: 302,
          headers: {
            "Location": redirectUrl,
            ...corsHeaders
          }
        });
      } else {
        console.log("APP_BASE_URL not set, cannot redirect");
      }
    } else {
      console.log("Payment not successful, returning JSON response");
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
