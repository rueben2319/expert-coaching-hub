import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { meetingId } = await req.json();

    // Get meeting details
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .eq('user_id', user.id)
      .single();

    if (meetingError || !meeting) {
      throw new Error('Meeting not found or unauthorized');
    }

    // Get Google OAuth token
    const { data: identities } = await supabase
      .from('auth.identities')
      .select('provider_token')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .single();

    if (!identities?.provider_token) {
      throw new Error('No Google OAuth token found');
    }

    // Cancel Google Calendar event
    const calendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${meeting.calendar_event_id}?sendUpdates=all`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${identities.provider_token}`,
        },
      }
    );

    if (!calendarResponse.ok && calendarResponse.status !== 410) {
      console.error('Failed to cancel calendar event');
    }

    // Update meeting status
    const { error: updateError } = await supabase
      .from('meetings')
      .update({ status: 'cancelled' })
      .eq('id', meetingId);

    if (updateError) {
      throw updateError;
    }

    // Log analytics
    await supabase.from('meeting_analytics').insert({
      meeting_id: meetingId,
      user_id: user.id,
      event_type: 'meeting_cancelled',
    });

    console.log('Meeting cancelled:', meetingId);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error cancelling meeting:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
