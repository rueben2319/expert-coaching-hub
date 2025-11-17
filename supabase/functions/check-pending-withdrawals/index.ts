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
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const payChanguSecret = Deno.env.get("PAYCHANGU_SECRET_KEY");

    if (!supabaseUrl || !supabaseKey || !payChanguSecret) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all withdrawals that are still processing
    // Only check those older than 5 minutes to avoid checking too frequently
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: pendingWithdrawals, error } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("status", "processing")
      .lt("created_at", fiveMinutesAgo)
      .limit(50); // Process in batches

    if (error) {
      console.error("Error fetching pending withdrawals:", error);
      throw error;
    }

    console.log(`Found ${pendingWithdrawals?.length || 0} pending withdrawals to check`);

    const results = [];

    for (const withdrawal of pendingWithdrawals || []) {
      try {
        // Skip if no transaction ID
        if (!withdrawal.transaction_ref) {
          console.log(`Skipping withdrawal ${withdrawal.id} - no transaction ID`);
          results.push({
            id: withdrawal.id,
            status: "skipped",
            reason: "no_transaction_id",
          });
          continue;
        }

        console.log(`Checking status for withdrawal ${withdrawal.id} with trans_id ${withdrawal.transaction_ref}`);

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
          console.warn(`PayChangu API error for withdrawal ${withdrawal.id}: ${response.status}`);
          results.push({
            id: withdrawal.id,
            status: "error",
            reason: `api_error_${response.status}`,
          });
          continue;
        }

        const result = await response.json();
        console.log(`PayChangu response for ${withdrawal.id}:`, JSON.stringify(result, null, 2));

        const txStatus = result.data?.status?.toLowerCase();
        
        if (!txStatus) {
          console.warn(`No status in PayChangu response for withdrawal ${withdrawal.id}`);
          results.push({
            id: withdrawal.id,
            status: "unknown",
            reason: "no_status_in_response",
          });
          continue;
        }

        let updateData: any = {};
        let shouldUpdate = false;

        if (["success", "completed"].includes(txStatus)) {
          updateData.status = "completed";
          updateData.completed_at = new Date().toISOString();
          shouldUpdate = true;
          console.log(`Marking withdrawal ${withdrawal.id} as completed`);
        } else if (["failed", "rejected", "cancelled"].includes(txStatus)) {
          updateData.status = "failed";
          updateData.failure_reason = result.data?.failure_reason || "Payment provider reported failure";
          shouldUpdate = true;
          console.log(`Marking withdrawal ${withdrawal.id} as failed: ${updateData.failure_reason}`);
        } else if (txStatus === "pending" || txStatus === "processing") {
          // Still processing, no update needed
          console.log(`Withdrawal ${withdrawal.id} still pending with PayChangu`);
          results.push({
            id: withdrawal.id,
            status: "still_processing",
            reason: txStatus,
          });
          continue;
        } else {
          console.warn(`Unknown status for withdrawal ${withdrawal.id}: ${txStatus}`);
          results.push({
            id: withdrawal.id,
            status: "unknown",
            reason: txStatus,
          });
          continue;
        }

        if (shouldUpdate) {
          // Update the withdrawal status
          const { error: updateError } = await supabase
            .from("withdrawal_requests")
            .update(updateData)
            .eq("id", withdrawal.id);

          if (updateError) {
            console.error(`Error updating withdrawal ${withdrawal.id}:`, updateError);
            results.push({
              id: withdrawal.id,
              status: "update_failed",
              reason: updateError.message,
            });
          } else {
            results.push({
              id: withdrawal.id,
              status: updateData.status,
              updated: true,
            });
          }
        }
      } catch (err) {
        console.error(`Error processing withdrawal ${withdrawal.id}:`, err);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        results.push({
          id: withdrawal.id,
          status: "error",
          reason: errorMessage,
        });
      }
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        results,
        message: "Processed pending withdrawals",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Check pending withdrawals error:", error);
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
