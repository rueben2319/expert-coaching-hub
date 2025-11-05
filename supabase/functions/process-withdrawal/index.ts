import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Check if user is admin
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    const { withdrawal_id, action, admin_notes } = await req.json();

    if (!withdrawal_id || !action) {
      throw new Error("Missing required fields");
    }

    // Get withdrawal request
    const { data: withdrawal, error: fetchError } = await supabaseClient
      .from("withdrawal_requests")
      .select("*")
      .eq("id", withdrawal_id)
      .single();

    if (fetchError) throw fetchError;
    if (!withdrawal) throw new Error("Withdrawal request not found");

    if (withdrawal.status !== "pending") {
      throw new Error("Only pending withdrawals can be processed");
    }

    let newStatus: string;
    let processedBy = user.id;

    if (action === "approve") {
      // TODO: Integrate with actual payment gateway (PayChangu)
      // For now, we'll mark as completed
      newStatus = "completed";

      // Process the withdrawal using the existing database function
      const { error: processError } = await supabaseClient.rpc("process_withdrawal", {
        coach_id: withdrawal.coach_id,
        credits_amount: withdrawal.credits_amount,
        amount_mwk: withdrawal.amount_mwk,
        withdrawal_id: withdrawal_id,
        payment_method: "mobile_money",
      });

      if (processError) throw processError;

    } else if (action === "reject") {
      newStatus = "failed";
    } else {
      throw new Error("Invalid action");
    }

    // Update withdrawal request
    const { error: updateError } = await supabaseClient
      .from("withdrawal_requests")
      .update({
        status: newStatus,
        processed_at: new Date().toISOString(),
        processed_by: processedBy,
        admin_notes: admin_notes || null,
      })
      .eq("id", withdrawal_id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Withdrawal ${action === "approve" ? "approved" : "rejected"} successfully`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error processing withdrawal:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
