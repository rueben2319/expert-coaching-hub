// @ts-ignore: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase environment configuration");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const token = authHeader.replace("Bearer ", "");

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const [invoicesRes, subsRes, txsRes] = await Promise.all([
      supabase.from("invoices").select("id, invoice_number, amount, currency, status, invoice_date, description, payment_method, subscription_id").eq("user_id", user.id).order("invoice_date", { ascending: false }),
      supabase.from("coach_subscriptions").select("id, status, tier_id, start_date, end_date, renewal_date, billing_cycle").eq("coach_id", user.id).order("start_date", { ascending: false }),
      supabase.from("transactions").select("id, transaction_ref, amount, currency, status, created_at, subscription_id").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

    return new Response(
      JSON.stringify({
        invoices: invoicesRes.data ?? [],
        subscriptions: subsRes.data ?? [],
        transactions: txsRes.data ?? [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
