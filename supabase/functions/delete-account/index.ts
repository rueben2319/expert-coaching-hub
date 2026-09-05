// @ts-expect-error: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

import { getCorsHeaders, handleCorsPreflight, withCorsHeaders } from "../_shared/cors.ts";
const CONFIRMATION_TEXT = "DELETE MY ACCOUNT";

serve(async (req: Request) => {
  const requestOrigin = req.headers.get("Origin");
  if (req.method === 'OPTIONS') { return handleCorsPreflight(req.headers.get('Origin')); }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Missing Supabase environment configuration");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" },
      });
    }

    const user = authData.user;

    const body = await req.json().catch(() => ({}));
    const confirmationText = typeof body?.confirmationText === "string" ? body.confirmationText.trim() : "";

    if (confirmationText !== CONFIRMATION_TEXT) {
      return new Response(JSON.stringify({ error: `Confirmation text must be exactly '${CONFIRMATION_TEXT}'` }), {
        status: 400,
        headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { error: auditError } = await adminClient.from("security_audit_log").insert({
      event_type: "self_account_delete",
      details: {
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        confirmation_text_matched: true,
        deleted_at: new Date().toISOString(),
      },
    });

    if (auditError) {
      console.error("Failed to write account deletion audit log:", auditError);
      return new Response(JSON.stringify({ error: "Failed to write audit log" }), {
        status: 500,
        headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" },
      });
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("Failed to delete user:", deleteError);
      return new Response(JSON.stringify({ error: "Failed to delete account" }), {
        status: 500,
        headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("delete-account error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req.headers.get('Origin')), "Content-Type": "application/json" },
    });
  }
});
