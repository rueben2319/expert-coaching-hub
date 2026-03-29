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

type FinalizeResponse = {
  role: "client" | "coach" | "admin";
  onboarding_state: "ready" | "role_bootstrapped" | "needs_role_selection";
  redirect_to: string;
};

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userData.user;
    const fullName = (user.user_metadata?.full_name as string | undefined) ?? null;
    const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null;

    const { data: finalizeData, error: finalizeError } = await adminClient.rpc("finalize_oauth_callback", {
      p_user_id: user.id,
      p_email: user.email,
      p_full_name: fullName,
      p_avatar_url: avatarUrl,
    });

    if (finalizeError) {
      throw finalizeError;
    }

    const result = (Array.isArray(finalizeData) ? finalizeData[0] : finalizeData) as FinalizeResponse | null;
    if (!result?.role || !result?.onboarding_state || !result?.redirect_to) {
      throw new Error("OAuth finalization returned an incomplete response.");
    }

    const nextAppMetadata = {
      ...(user.app_metadata ?? {}),
      role: result.role,
    };

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      app_metadata: nextAppMetadata,
    });

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("oauth-callback error", error);
    return new Response(JSON.stringify({ error: "Failed to finalize OAuth callback" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
