// @ts-ignore: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

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
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  const rawBody = await req.text();
  const signature = req.headers.get("Signature");
  const valid = await verifySignature(rawBody, signature);
  if (!valid) return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const payload = JSON.parse(rawBody) as WebhookPayload;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase environment configuration");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const status = payload.data?.status || payload.status;
    const tx_ref = payload.data?.tx_ref;

    if (!tx_ref) throw new Error("Missing tx_ref in webhook payload");

    // Find transaction
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("id, user_id, amount, currency, status, order_id, subscription_id")
      .eq("transaction_ref", tx_ref)
      .single();
    if (txErr || !tx) throw new Error("Transaction not found");

    const success = status === "successful" || status === "success" || status === "completed";

    // Update transaction status and gateway response
    await (supabase.from("transactions") as any)
      .update({ status: success ? "success" : "failed", gateway_response: payload })
      .eq("id", tx.id);

    if (success) {
      // Update related records
      if (tx.subscription_id) {
        // Activate coach subscription
        const now = new Date();
        // Fetch billing cycle to set renewal_date
        const { data: sub, error: subErr } = await supabase
          .from("coach_subscriptions")
          .select("id, billing_cycle")
          .eq("id", tx.subscription_id)
          .single();
        if (!subErr && sub) {
          const renewal = new Date(now);
          if (sub.billing_cycle === "yearly") renewal.setFullYear(now.getFullYear() + 1);
          else renewal.setMonth(now.getMonth() + 1);

          await (supabase.from("coach_subscriptions") as any)
            .update({ status: "active", renewal_date: renewal.toISOString(), transaction_id: tx.id, start_date: now.toISOString() })
            .eq("id", tx.subscription_id);

          // Create invoice
          const { data: invNum } = await supabase.rpc("generate_invoice_number");
          await (supabase.from("invoices") as any).insert({
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
          });
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
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
