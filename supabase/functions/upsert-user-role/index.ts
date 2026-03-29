import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime  
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RoleRequest {
  user_id: string;
  role: 'client' | 'coach' | 'admin';
  reason?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate the caller via Authorization header (Bearer jwt)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Load caller role for authorization decisions
    const { data: roleRow, error: roleErr } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
    if (roleErr) {
      return new Response(JSON.stringify({ error: 'Failed to resolve caller role' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const callerRole = roleRow?.role || null;

    // Parse body
    const body: RoleRequest = await req.json();
    const { user_id, role, reason } = body;
    if (!user_id || !role) {
      return new Response(JSON.stringify({ error: 'Missing user_id or role' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!['client', 'coach', 'admin'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Authorization model:
    // - Admins can assign roles for any user (including admin)
    // - Non-admin users can only set their own role to client/coach (never admin)
    const isSelfUpdate = user_id === user.id;
    const isAdminCaller = callerRole === 'admin';
    if (!isAdminCaller) {
      if (!isSelfUpdate) {
        return new Response(JSON.stringify({ error: 'Forbidden: only admins can change another user role' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (role === 'admin') {
        return new Response(JSON.stringify({ error: 'Forbidden: cannot self-assign admin role' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Upsert role (user can only have one role, so we update on user_id conflict)
    const { data, error } = await supabase.from('user_roles').upsert(
      { user_id, role },
      { onConflict: 'user_id' }
    );

    if (error) {
      console.error('Failed upserting role:', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Insert into role changes audit table
    try {
      await supabase.from('user_role_changes').insert({ user_id, role, changed_by: user.id });
    } catch (e) {
      console.warn('Failed to write role change audit:', e);
    }

    // Security audit event
    try {
      await supabase.from('security_audit_log').insert({
        event_type: isAdminCaller ? 'admin_role_upsert' : 'self_role_upsert',
        user_id: user.id,
        target_user_id: user_id,
        details: {
          assigned_role: role,
          caller_role: callerRole,
          is_self_update: isSelfUpdate,
          reason: reason ?? null,
        },
      });
    } catch (e) {
      console.warn('Failed to write security audit log:', e);
    }

    // Keep signed auth claims aligned for downstream session/JWT role checks
    await supabase.auth.admin
      .updateUserById(user_id, {
        user_metadata: { role },
        app_metadata: { role },
      })
      .catch(() => {});

    return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('Error in upsert-user-role function:', e);
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
