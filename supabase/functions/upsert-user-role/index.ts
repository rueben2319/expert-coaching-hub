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

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Ensure caller is admin
    const { data: roleRow, error: roleErr } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
    const callerRole = roleRow?.role || null;
    if (callerRole !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Parse body
    const body: RoleRequest = await req.json();
    const { user_id, role } = body;
    if (!user_id || !role) {
      return new Response(JSON.stringify({ error: 'Missing user_id or role' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!['client', 'coach', 'admin'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Upsert role
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

    // Optionally update auth metadata
    await supabase.auth.admin.updateUserById(user_id, { user_metadata: { role } }).catch(() => {});

    return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('Error in upsert-user-role function:', e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
