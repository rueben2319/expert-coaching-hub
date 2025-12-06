import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const { certificateId } = await req.json()
    
    if (!certificateId) {
      throw new Error('Certificate ID is required')
    }

    // Get certificate details
    const { data: certificate, error: certError } = await supabaseClient
      .from('course_certificates')
      .select(`
        *,
        courses!inner(title),
        profiles!inner(full_name)
      `)
      .eq('certificate_id', certificateId)
      .single()

    if (certError || !certificate) {
      throw new Error('Certificate not found')
    }

    // Generate shareable verification link
    const verificationUrl = `${Deno.env.get('SUPABASE_URL')?.replace('/rest/v1', '')}/verify/${certificateId}`

    return new Response(
      JSON.stringify({ 
        shareUrl: verificationUrl,
        certificate: {
          id: certificate.certificate_id,
          course: certificate.courses.title,
          student: certificate.profiles.full_name,
          issuedAt: certificate.issued_at,
          status: certificate.verification_status
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
