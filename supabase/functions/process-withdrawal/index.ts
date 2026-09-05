import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

import { getCorsHeaders, handleCorsPreflight, withCorsHeaders } from "../_shared/cors.ts";
serve(async (req) => {
  if (req.method === 'OPTIONS') { return handleCorsPreflight(req.headers.get('Origin')); });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
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

    // Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      throw new Error("Invalid JSON payload");
    }

    const { withdrawal_id, action, admin_notes } = body;

    // Validate withdrawal_id
    if (!withdrawal_id || typeof withdrawal_id !== 'string') {
      throw new Error("withdrawal_id must be a valid string");
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(withdrawal_id)) {
      throw new Error("Invalid withdrawal_id format");
    }

    // Validate action
    if (!action || !['approve', 'reject'].includes(action)) {
      throw new Error("Action must be 'approve' or 'reject'");
    }

    // Validate admin_notes length
    if (admin_notes && (typeof admin_notes !== 'string' || admin_notes.length > 1000)) {
      throw new Error("Admin notes must be a string with max 1000 characters");
    }

    const { data: processResult, error: processError } = await supabaseClient.rpc("admin_process_withdrawal", {
      p_withdrawal_id: withdrawal_id,
      p_action: action,
      p_admin_id: user.id,
      p_admin_notes: admin_notes || null,
    });

    if (processError) throw processError;

    return new Response(
      JSON.stringify(processResult),
      {
        headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error processing withdrawal:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
