// @ts-ignore: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { getCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req.headers.get('Origin'));

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: getCorsHeaders(req.headers.get('Origin')) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate as admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" },
      });
    }

    // Verify user is admin
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!userRole || userRole.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const body = await req.json();
    const { transaction_id, confirm_payment_received } = body;

    if (!transaction_id) {
      return new Response(JSON.stringify({ error: "transaction_id is required" }), {
        status: 400,
        headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" },
      });
    }

    if (!confirm_payment_received) {
      return new Response(JSON.stringify({ 
        error: "Must confirm payment was received before recovering transaction" 
      }), {
        status: 400,
        headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" },
      });
    }

    console.log(`🔧 RECOVERY: Processing transaction ${transaction_id}`);

    // Fetch transaction details
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("id, user_id, credits_amount, amount, currency, status, credit_package_id, transaction_ref")
      .eq("id", transaction_id)
      .single();

    if (txErr || !tx) {
      return new Response(JSON.stringify({ error: "Transaction not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" },
      });
    }

    if (tx.status === "success") {
      return new Response(JSON.stringify({ 
        error: "Transaction already processed successfully" 
      }), {
        status: 400,
        headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" },
      });
    }

    console.log(`📋 Transaction details:`, {
      user_id: tx.user_id,
      credits_amount: tx.credits_amount,
      status: tx.status,
    });

    // Get or create wallet
    const { data: wallet, error: walletErr } = await supabase
      .from("credit_wallets")
      .select("balance")
      .eq("user_id", tx.user_id)
      .single();

    let userWallet = wallet;
    if (walletErr || !wallet) {
      console.log(`Creating new wallet for user ${tx.user_id}`);
      const { data: newWallet, error: createErr } = await supabase
        .from("credit_wallets")
        .insert({ user_id: tx.user_id, balance: 0 })
        .select()
        .single();

      if (createErr || !newWallet) {
        throw new Error("Failed to create wallet: " + createErr?.message);
      }
      userWallet = newWallet;
    }

    const creditsToAdd = Number(tx.credits_amount);
    const balanceBefore = Number(userWallet.balance);
    const balanceAfter = balanceBefore + creditsToAdd;

    console.log(`💰 Adding ${creditsToAdd} credits to wallet`, {
      before: balanceBefore,
      after: balanceAfter,
    });

    // Update transaction to success
    const { error: updateTxErr } = await supabase
      .from("transactions")
      .update({
        status: "success",
        gateway_response: { manual_recovery: true, recovered_at: new Date().toISOString() },
      })
      .eq("id", tx.id);

    if (updateTxErr) {
      throw new Error("Failed to update transaction status: " + updateTxErr.message);
    }

    // Update wallet
    const { error: updateWalletErr } = await supabase
      .from("credit_wallets")
      .update({
        balance: balanceAfter,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", tx.user_id);

    if (updateWalletErr) {
      throw new Error("Failed to update wallet: " + updateWalletErr.message);
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
        description: `Purchased ${creditsToAdd} credits (recovered from failed webhook)`,
        metadata: {
          package_id: tx.credit_package_id,
          transaction_ref: tx.transaction_ref,
          recovery: true,
        },
      });

    if (creditTxErr) {
      console.error("Failed to create credit transaction record:", creditTxErr);
      // Don't throw here - recovery is already complete
    }

    // Create invoice
    const now = new Date();
    const { data: invNum } = await supabase.rpc("generate_invoice_number");
    const { error: invErr } = await supabase
      .from("invoices")
      .insert({
        user_id: tx.user_id,
        amount: tx.amount,
        currency: tx.currency,
        invoice_number: invNum ?? `INV-${Date.now()}`,
        invoice_date: now.toISOString(),
        payment_method: "paychangu",
        description: "Credit purchase (recovered)",
        status: "paid",
        subscription_id: null,
        order_id: null,
      });

    if (invErr) {
      console.error("Failed to create invoice:", invErr);
    }

    console.log(`✅ RECOVERY COMPLETE for transaction ${transaction_id}`);

    return new Response(JSON.stringify({
      success: true,
      message: "Transaction recovered successfully",
      details: {
        transaction_id: tx.id,
        user_id: tx.user_id,
        credits_added: creditsToAdd,
        new_balance: balanceAfter,
      },
    }), {
      status: 200,
      headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" },
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("❌ Recovery error:", msg, e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" },
    });
  }
});
