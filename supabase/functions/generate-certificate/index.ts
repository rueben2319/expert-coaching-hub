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

    // Verify certificate exists and get details
    const { data: certificate, error: certError } = await supabaseClient
      .from('course_certificates')
      .select(`
        *,
        courses!inner(title, coach_id),
        profiles!inner(full_name)
      `)
      .eq('certificate_id', certificateId)
      .single()

    if (certError || !certificate) {
      throw new Error('Certificate not found')
    }

    // Generate certificate PDF (this is a simplified version)
    // In production, you'd use a PDF library like PDFKit or Puppeteer
    const certificateHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          .certificate {
            width: 800px;
            height: 600px;
            border: 10px solid #4F46E5;
            margin: 0 auto;
            padding: 40px;
            text-align: center;
            position: relative;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .certificate h1 { font-size: 36px; margin-bottom: 20px; }
          .certificate h2 { font-size: 24px; margin: 20px 0; }
          .certificate p { font-size: 18px; margin: 10px 0; }
          .certificate .date { position: absolute; bottom: 40px; right: 40px; }
          .certificate .id { position: absolute; bottom: 20px; left: 40px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="certificate">
          <h1>Certificate of Completion</h1>
          <p>This is to certify that</p>
          <h2>${certificate.profiles.full_name}</h2>
          <p>has successfully completed the course</p>
          <h2>${certificate.courses.title}</h2>
          <div class="date">Issued: ${new Date(certificate.issued_at).toLocaleDateString()}</div>
          <div class="id">Certificate ID: ${certificate.certificate_id}</div>
        </div>
      </body>
      </html>
    `

    // For now, return the HTML. In production, convert to PDF
    return new Response(
      JSON.stringify({ 
        certificateHtml,
        certificateUrl: `data:text/html;charset=utf-8,${encodeURIComponent(certificateHtml)}`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
