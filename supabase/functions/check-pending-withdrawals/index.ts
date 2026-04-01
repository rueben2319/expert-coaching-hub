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

    // SECURITY: Require admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
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

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all withdrawals that are still processing
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: pendingWithdrawals, error } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("status", "processing")
      .lt("created_at", fiveMinutesAgo)
      .limit(50);

    if (error) {
      console.error("Error fetching pending withdrawals:", error);
      throw error;
    }

    console.log(`Found ${pendingWithdrawals?.length || 0} pending withdrawals to check`);

    const results = [];

    for (const withdrawal of pendingWithdrawals || []) {
      try {
        if (!withdrawal.transaction_ref) {
          results.push({ id: withdrawal.id, status: "skipped", reason: "no_transaction_id" });
          continue;
        }

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

        if (!response.ok) {
          results.push({ id: withdrawal.id, status: "error", reason: `api_error_${response.status}` });
          continue;
        }

        const result = await response.json();
        const txStatus = result.data?.status?.toLowerCase();
        
        if (!txStatus) {
          results.push({ id: withdrawal.id, status: "unknown", reason: "no_status_in_response" });
          continue;
        }

        let updateData: any = {};
        let shouldUpdate = false;

        if (["success", "completed"].includes(txStatus)) {
          updateData.status = "completed";
          updateData.completed_at = new Date().toISOString();
          shouldUpdate = true;
        } else if (["failed", "rejected", "cancelled"].includes(txStatus)) {
          updateData.status = "failed";
          updateData.failure_reason = result.data?.failure_reason || "Payment provider reported failure";
          shouldUpdate = true;
        } else if (txStatus === "pending" || txStatus === "processing") {
          results.push({ id: withdrawal.id, status: "still_processing", reason: txStatus });
          continue;
        } else {
          results.push({ id: withdrawal.id, status: "unknown", reason: txStatus });
          continue;
        }

        if (shouldUpdate) {
          const { error: updateError } = await supabase
            .from("withdrawal_requests")
            .update(updateData)
            .eq("id", withdrawal.id);

          if (updateError) {
            results.push({ id: withdrawal.id, status: "update_failed", reason: updateError.message });
          } else {
            results.push({ id: withdrawal.id, status: updateData.status, updated: true });
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        results.push({ id: withdrawal.id, status: "error", reason: errorMessage });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results, message: "Processed pending withdrawals" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Check pending withdrawals error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
