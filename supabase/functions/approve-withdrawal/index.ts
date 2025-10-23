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

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate admin user
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

    // Verify user is an admin
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!userRole || userRole.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only admins can approve withdrawals" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const body = await req.json();
    const { withdrawal_request_id, action, admin_notes } = body;

    if (!withdrawal_request_id || !action) {
      return new Response(
        JSON.stringify({ error: "withdrawal_request_id and action are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["approve", "reject"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "Action must be 'approve' or 'reject'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get withdrawal request
    const { data: withdrawalRequest, error: requestErr } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("id", withdrawal_request_id)
      .single();

    if (requestErr || !withdrawalRequest) {
      return new Response(JSON.stringify({ error: "Withdrawal request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (withdrawalRequest.status !== "pending") {
      return new Response(JSON.stringify({ error: "Withdrawal request has already been processed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const coachId = withdrawalRequest.coach_id;
    const creditsAmount = Number(withdrawalRequest.credits_amount);

    if (action === "approve") {
      // Get coach's current wallet balance
      const { data: wallet, error: walletErr } = await supabase
        .from("credit_wallets")
        .select("*")
        .eq("user_id", coachId)
        .single();

      if (walletErr || !wallet) {
        return new Response(JSON.stringify({ error: "Coach wallet not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const currentBalance = Number(wallet.balance);

      if (currentBalance < creditsAmount) {
        return new Response(JSON.stringify({
          error: "Insufficient balance - credits may have been spent",
          current_balance: currentBalance,
          requested: creditsAmount,
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Deduct credits from wallet
      const balanceAfter = currentBalance - creditsAmount;

      const { error: updateErr } = await supabase
        .from("credit_wallets")
        .update({
          balance: balanceAfter,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", coachId);

      if (updateErr) {
        console.error("Failed to update wallet:", updateErr);
        throw new Error("Failed to update wallet balance");
      }

      // Create credit transaction record
      const { error: creditTxErr } = await supabase
        .from("credit_transactions")
        .insert({
          user_id: coachId,
          transaction_type: "withdrawal",
          amount: -creditsAmount,
          balance_before: currentBalance,
          balance_after: balanceAfter,
          reference_type: "withdrawal_request",
          reference_id: withdrawalRequest.id,
          description: `Approved withdrawal: ${creditsAmount} credits → ${withdrawalRequest.amount} MWK`,
          metadata: {
            payment_method: withdrawalRequest.payment_method,
            amount_mwk: withdrawalRequest.amount,
            admin_approved_by: user.id,
          },
        });

      if (creditTxErr) {
        console.error("Failed to create credit transaction:", creditTxErr);
        // Continue anyway - withdrawal is approved
      }

      // Update withdrawal request status
      const { error: statusErr } = await supabase
        .from("withdrawal_requests")
        .update({
          status: "approved",
          processed_at: new Date().toISOString(),
          processed_by: user.id,
          admin_notes: admin_notes || null,
        })
        .eq("id", withdrawal_request_id);

      if (statusErr) {
        console.error("Failed to update withdrawal status:", statusErr);
        throw new Error("Failed to update withdrawal status");
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: "approved",
          withdrawal_request_id: withdrawalRequest.id,
          credits_deducted: creditsAmount,
          new_balance: balanceAfter,
          message: "Withdrawal approved successfully",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "reject") {
      // Just update the status to rejected - no credit changes
      const { error: statusErr } = await supabase
        .from("withdrawal_requests")
        .update({
          status: "rejected",
          processed_at: new Date().toISOString(),
          processed_by: user.id,
          admin_notes: admin_notes || null,
        })
        .eq("id", withdrawal_request_id);

      if (statusErr) {
        console.error("Failed to update withdrawal status:", statusErr);
        throw new Error("Failed to update withdrawal status");
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: "rejected",
          withdrawal_request_id: withdrawalRequest.id,
          message: "Withdrawal rejected successfully",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("Error in approve-withdrawal:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
