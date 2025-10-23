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
  "Access-Control-Allow-Methods": "OPTIONS, GET, POST",
  "Access-Control-Max-Age": "86400",
};

type WebhookPayload = {
  status: string;
  message?: string;
  data?: {
    tx_ref?: string;
    amount?: number;
    currency?: string;
    status?: string;
    charge_id?: string; // ✅ Added charge_id
  };
  // PayChangu sends tx_ref at root level
  tx_ref?: string;
  event_type?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  amount?: number;
  currency?: string;
  charge?: number;
  charge_id?: string; // ✅ Added charge_id
  amount_split?: any;
  total_amount_paid?: number;
  mode?: string;
  type?: string;
  reference?: string;
  customization?: any;
  meta?: any;
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
  console.log("=== PAYCHANGU WEBHOOK RECEIVED ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  console.log("Headers:", Object.fromEntries(req.headers.entries()));
  console.log("Timestamp:", new Date().toISOString());

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Handle GET requests for endpoint verification (PayChangu health checks)
  if (req.method === "GET") {
    // Check if this is a redirect request with tx_ref (user being redirected after payment)
    const url = new URL(req.url);
    const txRef = url.searchParams.get('tx_ref');

    if (txRef) {
      // Find transaction to determine redirect URL
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: tx } = await supabase
          .from("transactions")
          .select("transaction_mode")
          .eq("transaction_ref", txRef)
          .single();

        const appBaseUrl = Deno.env.get("APP_BASE_URL") || "http://localhost:8080";

        // Redirect based on transaction type
        if (tx?.transaction_mode === "credit_purchase") {
          const redirectUrl = `${appBaseUrl}/client/credits/success?tx_ref=${txRef}`;
          return Response.redirect(redirectUrl, 302);
        } else {
          // Default to coach billing success
          const redirectUrl = `${appBaseUrl}/coach/billing/success?tx_ref=${txRef}`;
          return Response.redirect(redirectUrl, 302);
        }
      }

      // Fallback redirect to coach billing
      const appBaseUrl = Deno.env.get("APP_BASE_URL") || "http://localhost:8080";
      const redirectUrl = `${appBaseUrl}/coach/billing/success?tx_ref=${txRef}`;
      return Response.redirect(redirectUrl, 302);
    }

    // Regular health check
    return new Response(JSON.stringify({ status: "ok", message: "Webhook endpoint is active" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    console.log("Non-POST request received, ignoring");
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  console.log("Processing POST webhook request");

  let payload: WebhookPayload;
  const rawBody = await req.text();
  console.log("Raw body length:", rawBody.length);
  console.log("Raw body preview:", rawBody.substring(0, 500) + (rawBody.length > 500 ? "..." : ""));

  const signature = req.headers.get("Signature") || req.headers.get("signature");
  console.log("Signature present:", !!signature);

  // Require secret and signature for all environments
  if (!Deno.env.get("PAYCHANGU_WEBHOOK_SECRET") || !signature) {
    return new Response(JSON.stringify({ error: "Missing signature or secret" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const valid = await verifySignature(rawBody, signature);
  console.log("Signature verification result:", valid);

  if (!valid) {
    console.error("❌ SIGNATURE VERIFICATION FAILED");
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("✅ Signature verification passed");

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
    const tx_ref = payload.data?.tx_ref || (payload as any).tx_ref;

    if (!tx_ref) throw new Error("Missing tx_ref in webhook payload");

    console.log("Webhook payload status:", status);
    console.log("Transaction ref:", tx_ref);

    // Find transaction with all necessary fields
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("id, user_id, amount, currency, status, order_id, subscription_id, transaction_mode, credits_amount, credit_package_id")
      .eq("transaction_ref", tx_ref)
      .single();

    console.log("Transaction lookup result:", { tx: !!tx, txErr: txErr?.message });
    if (tx) {
      console.log("Transaction details:", {
        id: tx.id,
        user_id: tx.user_id,
        transaction_mode: tx.transaction_mode,
        credits_amount: tx.credits_amount,
        status: tx.status
      });
    }

    if (txErr || !tx) throw new Error("Transaction not found");

    const success = status === "successful" || status === "success" || status === "completed";
    console.log("Payment success status:", success);

    // Update transaction status and gateway response
    await (supabase.from("transactions") as any)
      .update({ status: success ? "success" : "failed", gateway_response: payload })
      .eq("id", tx.id);

    // Check if this is a payout (withdrawal) transaction
    const isPayout = tx_ref.startsWith("WD-");
    console.log("Is payout transaction:", isPayout);

    if (success) {
      console.log("Payment was successful, processing updates...");

      // Handle credit purchases
      if (tx.transaction_mode === "credit_purchase") {
        console.log("🎯 Processing CREDIT PURCHASE for user:", tx.user_id);
        console.log("Credits amount:", tx.credits_amount);

        // Get user's wallet or create if it doesn't exist
        const { data: wallet, error: walletErr } = await supabase
          .from("credit_wallets")
          .select("*")
          .eq("user_id", tx.user_id)
          .single();

        let userWallet = wallet;
        if (walletErr || !wallet) {
          console.log("Wallet not found, creating new wallet for user:", tx.user_id);
          const { data: newWallet, error: createWalletErr } = await supabase
            .from("credit_wallets")
            .insert({
              user_id: tx.user_id,
              balance: 0,
            })
            .select()
            .single();

          if (createWalletErr || !newWallet) {
            console.error("Failed to create wallet:", createWalletErr);
            throw new Error("Failed to create wallet");
          }

          userWallet = newWallet;
          console.log("Created new wallet:", newWallet.id);
        }

        const creditsToAdd = Number(tx.credits_amount);
        const balanceBefore = Number(userWallet.balance);
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

        // Create invoice for credit purchase
        const now = new Date();
        const { data: invNum } = await supabase.rpc("generate_invoice_number");
        const invoiceData = {
          user_id: tx.user_id,
          amount: tx.amount,
          currency: tx.currency,
          invoice_number: invNum ?? `INV-${Date.now()}`,
          invoice_date: now.toISOString(),
          payment_method: "paychangu",
          description: "Credit purchase",
          status: "paid",
          subscription_id: null,
          order_id: null,
        };

        const { error: invErr } = await supabase
          .from("invoices")
          .insert(invoiceData);

        if (invErr) {
          console.error("Error creating invoice for credit purchase:", invErr);
        } else {
          console.log("Successfully created invoice for credit purchase");
        }

      } else if (isPayout) {
        console.log("💰 Processing PAYOUT (withdrawal) completion for user:", tx.user_id);

        // Extract withdrawal request ID from charge_id (WD-{id})
        const chargeId = payload.data?.charge_id || (payload as any).charge_id || (payload as any).charge;
        const withdrawalId = chargeId?.replace("WD-", "");

        if (withdrawalId) {
          // Update withdrawal request status
          const { error: withdrawalErr } = await supabase
            .from("withdrawal_requests")
            .update({
              status: "completed",
              processed_at: new Date().toISOString(),
              admin_notes: `Payout completed successfully. Ref: ${tx_ref}`
            })
            .eq("id", withdrawalId);

          if (withdrawalErr) {
            console.error("Failed to update withdrawal request status:", withdrawalErr);
          } else {
            console.log("Successfully updated withdrawal request status to completed");
          }
        } else {
          console.error("Could not extract withdrawal ID from charge_id:", chargeId);
        }

      } else if (tx.subscription_id) {
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

    } else {
      // Payment failed - handle failures
      console.log("Payment failed, handling error case...");

      if (isPayout) {
        console.log("❌ PAYOUT FAILED - handling withdrawal failure for user:", tx.user_id);

        // Extract withdrawal request ID from charge_id (WD-{id})
        const chargeId = payload.data?.charge_id || (payload as any).charge_id || (payload as any).charge;
        const withdrawalId = chargeId?.replace("WD-", "");

        if (withdrawalId) {
          // Update withdrawal request status to failed
          const { error: withdrawalErr } = await supabase
            .from("withdrawal_requests")
            .update({
              status: "failed",
              processed_at: new Date().toISOString(),
              admin_notes: `Payout failed. Error: ${JSON.stringify(payload)}`
            })
            .eq("id", withdrawalId);

          if (withdrawalErr) {
            console.error("Failed to update withdrawal request status:", withdrawalErr);
          } else {
            console.log("Successfully updated withdrawal request status to failed");
          }

          // IMPORTANT: Attempt to refund credits to user's wallet
          console.log("Attempting to refund credits to user wallet...");

          // Get the withdrawal request to know how many credits to refund
          const { data: withdrawalReq, error: reqErr } = await supabase
            .from("withdrawal_requests")
            .select("credits_amount, coach_id")
            .eq("id", withdrawalId)
            .single();

          if (!reqErr && withdrawalReq) {
            // Get user's wallet
            const { data: wallet, error: walletErr } = await supabase
              .from("credit_wallets")
              .select("balance")
              .eq("user_id", withdrawalReq.coach_id)
              .single();

            if (!walletErr && wallet) {
              const refundAmount = Number(withdrawalReq.credits_amount);
              const currentBalance = Number(wallet.balance);
              const newBalance = currentBalance + refundAmount;

              // Update wallet with refund
              const { error: refundErr } = await supabase
                .from("credit_wallets")
                .update({
                  balance: newBalance,
                  updated_at: new Date().toISOString(),
                })
                .eq("user_id", withdrawalReq.coach_id);

              if (!refundErr) {
                // Create refund transaction record
                const { error: refundTxErr } = await supabase
                  .from("credit_transactions")
                  .insert({
                    user_id: withdrawalReq.coach_id,
                    transaction_type: "refund",
                    amount: refundAmount,
                    balance_before: currentBalance,
                    balance_after: newBalance,
                    reference_type: "withdrawal_request",
                    reference_id: withdrawalId,
                    description: `Refund for failed withdrawal payout`,
                    metadata: {
                      payout_ref: tx_ref,
                      failure_reason: "Payout failed - credits refunded"
                    },
                  });

                if (refundTxErr) {
                  console.error("Failed to create refund transaction:", refundTxErr);
                } else {
                  console.log("Successfully refunded credits to user wallet");
                }
              } else {
                console.error("Failed to refund credits to wallet:", refundErr);
              }
            }
          }
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
    console.error("❌ WEBHOOK PROCESSING ERROR:", msg);
    console.error("Error details:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
