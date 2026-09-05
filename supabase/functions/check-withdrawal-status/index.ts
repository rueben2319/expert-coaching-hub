// @ts-ignore: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
// @ts-ignore: Deno imports work at runtime
import { z } from "https://esm.sh/zod@3.23.8";

import { getCorsHeaders, handleCorsPreflight, withCorsHeaders } from "../_shared/cors.ts";
// Minimal Deno type declaration for environment access
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const RequestSchema = z.object({
  withdrawalId: z.string().uuid(),
});

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') { return handleCorsPreflight(req.headers.get('Origin')); });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: getCorsHeaders(req.headers.get('Origin')) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const oneKhusaSecret = Deno.env.get("ONEKHUSA_SECRET_KEY");

    if (!supabaseUrl || !supabaseKey || !oneKhusaSecret) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" } },
      );
    }

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const isAdmin = roleRow?.role === "admin";

    const requestBody = await req.json();
    const parseResult = RequestSchema.safeParse(requestBody);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request body",
          details: parseResult.error.flatten(),
        }),
        { status: 400, headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" } },
      );
    }
    const { withdrawalId } = parseResult.data;

    const withdrawalQuery = supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("id", withdrawalId);

    if (!isAdmin) {
      withdrawalQuery.eq("coach_id", user.id);
    }

    const { data: withdrawal, error } = await withdrawalQuery.maybeSingle();

    if (error) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch withdrawal" }),
        { status: 500, headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" } },
      );
    }

    if (!withdrawal) {
      const { data: exists, error: existsError } = await supabase
        .from("withdrawal_requests")
        .select("id")
        .eq("id", withdrawalId)
        .maybeSingle();

      if (existsError) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch withdrawal" }),
          { status: 500, headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" } },
        );
      }

      if (exists) {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          { status: 403, headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ error: "Withdrawal not found" }),
        { status: 404, headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" } }
      );
    }

    if (withdrawal.status !== "processing") {
      return new Response(
        JSON.stringify({
          updated: false,
          message: `Withdrawal is already ${withdrawal.status}`,
          status: withdrawal.status,
        }),
        { status: 200, headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" } }
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
        { status: 200, headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" } }
      );
    }

    console.log(`Checking status for withdrawal ${withdrawalId} with trans_id ${withdrawal.transaction_ref}`);

    // Check transaction status with OneKhusa
    const response = await fetch(
      `https://api.onekhusa.com/mobile-money/payouts/status/${withdrawal.transaction_ref}`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${oneKhusaSecret}`,
        },
      }
    );

    console.log(`OneKhusa response status: ${response.status}`);

    if (!response.ok) {
      console.warn(`OneKhusa API error: ${response.status}`);
      return new Response(
        JSON.stringify({
          updated: false,
          message: "Failed to check status with payment provider. Please try again later.",
          status: withdrawal.status,
        }),
        { status: 200, headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    console.log(`OneKhusa response:`, JSON.stringify(result, null, 2));

    const txStatus = result.data?.status?.toLowerCase();

    if (!txStatus) {
      return new Response(
        JSON.stringify({
          updated: false,
          message: "Could not determine status from payment provider.",
          status: withdrawal.status,
        }),
        { status: 200, headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" } }
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
      console.log(`Withdrawal ${withdrawalId} still pending with OneKhusa`);
      return new Response(
        JSON.stringify({
          updated: false,
          message: "Withdrawal is still being processed by the payment provider. Please check again in a few moments.",
          status: withdrawal.status,
        }),
        { status: 200, headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" } }
      );
    } else {
      console.warn(`Unknown status for withdrawal ${withdrawalId}: ${txStatus}`);
      return new Response(
        JSON.stringify({
          updated: false,
          message: `Unknown status from payment provider: ${txStatus}`,
          status: withdrawal.status,
        }),
        { status: 200, headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" } }
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
          { status: 200, headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          updated: true,
          status: newStatus,
          message: `Withdrawal marked as ${newStatus}`,
        }),
        { status: 200, headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        updated: false,
        message: "No status update available.",
        status: withdrawal.status,
      }),
      { status: 200, headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" } }
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
        headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" },
      }
    );
  }
});
