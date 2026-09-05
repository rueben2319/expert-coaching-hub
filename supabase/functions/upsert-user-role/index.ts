import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { getCorsHeaders, handleCorsPreflight, withCorsHeaders } from "../_shared/cors.ts";

interface RoleRequest {
  user_id: string;
  role: "client" | "coach" | "admin";
  reason?: string;
}

type UserRole = "client" | "coach" | "admin";

const isUserRole = (value: unknown): value is UserRole =>
  value === "client" || value === "coach" || value === "admin";

serve(async (req: Request) => {
  const requestOrigin = req.headers.get("Origin");
  
  if (req.method === "OPTIONS") return handleCorsPreflight(requestOrigin);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate the caller via Authorization header (Bearer jwt)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      const errorResponse = new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
      return withCorsHeaders(errorResponse, requestOrigin);
    }

    const jwt = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(jwt);
    if (userErr || !user) {
      const errorResponse = new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
      return withCorsHeaders(errorResponse, requestOrigin);
    }

    // Parse body
    const body: RoleRequest = await req.json();
    const { user_id, role, reason } = body;
    if (!user_id || !role || !isUserRole(role)) {
      const errorResponse = new Response(JSON.stringify({ error: "Missing or invalid user_id/role" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
      return withCorsHeaders(errorResponse, requestOrigin);
    }

    // Use the secure database function for role assignment
    const { data: result, error: rpcError } = await supabase.rpc("secure_upsert_user_role", {
      p_target_user_id: user_id,
      p_new_role: role,
      p_reason: reason,
    });

    if (rpcError) {
      console.error("RPC error in secure_upsert_user_role:", rpcError);
      const errorResponse = new Response(JSON.stringify({ 
        error: "Failed to update role",
        details: rpcError.message 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
      return withCorsHeaders(errorResponse, requestOrigin);
    }

    if (!result || result.success !== true) {
      const errorResponse = new Response(JSON.stringify({ 
        error: result?.error || "Failed to update role" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
      return withCorsHeaders(errorResponse, requestOrigin);
    }

    const successResponse = new Response(JSON.stringify({ 
      success: true, 
      role: result.role,
      previous_role: result.previous_role 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    return withCorsHeaders(successResponse, requestOrigin);
  } catch (e) {
    console.error("Error in upsert-user-role function:", e);
    const message = e instanceof Error ? e.message : String(e);
    const errorResponse = new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
    return withCorsHeaders(errorResponse, requestOrigin);
  }
});
