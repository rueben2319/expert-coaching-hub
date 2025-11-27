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

    const { filePath } = await req.json()
    
    if (!filePath) {
      throw new Error('File path is required')
    }

    // Verify user has access to this file
    const { data: fileRecord, error: fileError } = await supabaseClient
      .from('course_files')
      .select(`
        *,
        courses!inner(coach_id),
        course_enrollments!inner(user_id)
      `)
      .eq('file_path', filePath)
      .or(`courses.coach_id.eq.${user.id},course_enrollments.user_id.eq.${user.id}`)
      .single()

    if (fileError || !fileRecord) {
      throw new Error('Access denied')
    }

    // Generate signed URL for file access
    const { data: { signedUrl }, error: signedError } = await supabaseClient.storage
      .from('course-content')
      .createSignedUrl(filePath, 3600) // 1 hour expiry

    if (signedError) {
      throw new Error('Failed to generate signed URL')
    }

    // Increment download count
    await supabaseClient.rpc('increment_file_download', { 
      file_id: fileRecord.id 
    })

    return new Response(
      JSON.stringify({ 
        signedUrl,
        fileName: fileRecord.file_name,
        fileType: fileRecord.file_type
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
