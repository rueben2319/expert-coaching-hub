// @ts-expect-error: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
};

type LoginBody = {
  email?: string;
  password?: string;
};

const AUTH_FAILURE_STATUS = 401;
const AUTH_FAILURE_BODY = { error: "Invalid login credentials" };

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Missing server configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as LoginBody;
    const normalizedEmail = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (!normalizedEmail || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const forwardedFor = req.headers.get("x-forwarded-for") ?? "";
    const rawIp = forwardedFor.split(",")[0]?.trim() || null;
    const userAgent = req.headers.get("user-agent") ?? null;

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const anon = createClient(supabaseUrl, anonKey);

    const { data: locked, error: lockError } = await admin.rpc("is_login_locked", {
      p_email: normalizedEmail,
      p_ip: rawIp,
    });

    if (lockError) {
      throw lockError;
    }

    if (locked) {
      await admin.rpc("record_login_attempt", {
        p_email: normalizedEmail,
        p_success: false,
        p_ip: rawIp,
        p_failure_reason: "locked_out",
      });

      return new Response(JSON.stringify({ error: "Too many failed attempts. Try again in 15 minutes." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: securityRows, error: securityError } = await admin.rpc("get_auth_user_security_by_email", {
      p_email: normalizedEmail,
    });

    if (securityError) {
      throw securityError;
    }

    const security = Array.isArray(securityRows) ? securityRows[0] : null;

    if (security?.bcrypt_cost != null && security.bcrypt_cost < 12) {
      await admin.rpc("record_login_attempt", {
        p_email: normalizedEmail,
        p_success: false,
        p_user_id: security.user_id,
        p_ip: rawIp,
        p_failure_reason: "hash_policy_below_min_cost",
      });

      return new Response(JSON.stringify(AUTH_FAILURE_BODY), {
        status: AUTH_FAILURE_STATUS,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (security && !security.email_verified) {
      await admin.rpc("record_login_attempt", {
        p_email: normalizedEmail,
        p_success: false,
        p_user_id: security.user_id,
        p_ip: rawIp,
        p_failure_reason: "email_unverified",
      });

      return new Response(JSON.stringify(AUTH_FAILURE_BODY), {
        status: AUTH_FAILURE_STATUS,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (signInError || !signInData.user || !signInData.session) {
      await admin.rpc("record_login_attempt", {
        p_email: normalizedEmail,
        p_success: false,
        p_user_id: security?.user_id ?? null,
        p_ip: rawIp,
        p_failure_reason: "invalid_credentials",
      });

      return new Response(JSON.stringify(AUTH_FAILURE_BODY), {
        status: AUTH_FAILURE_STATUS,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.rpc("record_login_attempt", {
      p_email: normalizedEmail,
      p_success: true,
      p_user_id: signInData.user.id,
      p_ip: rawIp,
      p_failure_reason: userAgent ? `ua:${userAgent.slice(0, 240)}` : null,
    });

    return new Response(JSON.stringify({
      session: signInData.session,
      user: signInData.user,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("auth-login error", error);
    return new Response(JSON.stringify({ error: "Authentication failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
