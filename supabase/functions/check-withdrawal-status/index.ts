// @ts-ignore: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

// Minimal Deno type declaration for environment access
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const payChanguSecret = Deno.env.get("PAYCHANGU_SECRET_KEY");

    if (!supabaseUrl || !supabaseKey || !payChanguSecret) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { withdrawalId } = await req.json();

    if (!withdrawalId) {
      return new Response(
        JSON.stringify({ error: "Withdrawal ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the withdrawal
    const { data: withdrawal, error } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("id", withdrawalId)
      .single();

    if (error || !withdrawal) {
      return new Response(
        JSON.stringify({ error: "Withdrawal not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (withdrawal.status !== "processing") {
      return new Response(
        JSON.stringify({
          updated: false,
          message: `Withdrawal is already ${withdrawal.status}`,
          status: withdrawal.status,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip if no transaction ID
    if (!withdrawal.transaction_ref) {
      return new Response(
        JSON.stringify({
          updated: false,
          message: "No transaction ID found. Cannot check status.",
          status: withdrawal.status,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Checking status for withdrawal ${withdrawalId} with trans_id ${withdrawal.transaction_ref}`);

    // Check transaction status with PayChangu
    const response = await fetch(
      `https://api.paychangu.com/mobile-money/payouts/status/${withdrawal.transaction_ref}`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${payChanguSecret}`,
        },
      }
    );

    console.log(`PayChangu response status: ${response.status}`);

    if (!response.ok) {
      console.warn(`PayChangu API error: ${response.status}`);
      return new Response(
        JSON.stringify({
          updated: false,
          message: "Failed to check status with payment provider. Please try again later.",
          status: withdrawal.status,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    console.log(`PayChangu response:`, JSON.stringify(result, null, 2));

    const txStatus = result.data?.status?.toLowerCase();

    if (!txStatus) {
      return new Response(
        JSON.stringify({
          updated: false,
          message: "Could not determine status from payment provider.",
          status: withdrawal.status,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let updateData: any = {};
    let updated = false;
    let newStatus = withdrawal.status;

    if (["success", "completed"].includes(txStatus)) {
      updateData.status = "completed";
      updateData.completed_at = new Date().toISOString();
      updated = true;
      newStatus = "completed";
      console.log(`Marking withdrawal ${withdrawalId} as completed`);
    } else if (["failed", "rejected", "cancelled"].includes(txStatus)) {
      updateData.status = "failed";
      updateData.failure_reason = result.data?.failure_reason || "Payment provider reported failure";
      updated = true;
      newStatus = "failed";
      console.log(`Marking withdrawal ${withdrawalId} as failed: ${updateData.failure_reason}`);
    } else if (txStatus === "pending" || txStatus === "processing") {
      // Still processing, no update needed
      console.log(`Withdrawal ${withdrawalId} still pending with PayChangu`);
      return new Response(
        JSON.stringify({
          updated: false,
          message: "Withdrawal is still being processed by the payment provider. Please check again in a few moments.",
          status: withdrawal.status,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      console.warn(`Unknown status for withdrawal ${withdrawalId}: ${txStatus}`);
      return new Response(
        JSON.stringify({
          updated: false,
          message: `Unknown status from payment provider: ${txStatus}`,
          status: withdrawal.status,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (updated) {
      // Update the withdrawal status
      const { error: updateError } = await supabase
        .from("withdrawal_requests")
        .update(updateData)
        .eq("id", withdrawalId);

      if (updateError) {
        console.error(`Error updating withdrawal ${withdrawalId}:`, updateError);
        return new Response(
          JSON.stringify({
            updated: false,
            message: "Failed to update withdrawal status in database.",
            status: withdrawal.status,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          updated: true,
          status: newStatus,
          message: `Withdrawal marked as ${newStatus}`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        updated: false,
        message: "No status update available.",
        status: withdrawal.status,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Check withdrawal status error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    return new Response(
      JSON.stringify({
        error: errorMessage,
        stack: errorStack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
