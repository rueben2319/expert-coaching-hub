// @ts-ignore: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { getValidatedGoogleToken, OAuthTokenManager } from "../_shared/oauth-token-manager.ts";

// Deno global type declaration for IDE
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header first to forward it to the client
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create client with forwarded Authorization header
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { meetingId } = await req.json();

    // Get meeting details
    const { data: meeting, error: meetingError} = await (supabase
      .from('meetings') as any)
      .select('*')
      .eq('id', meetingId)
      .eq('user_id', user.id)
      .single();

    if (meetingError || !meeting) {
      throw new Error('Meeting not found or unauthorized');
    }

    // Get validated Google OAuth token (handles refresh automatically)
    const { accessToken, refreshToken } = await getValidatedGoogleToken(supabase);

    // Cancel Google Calendar event using shared OAuth manager (handles 401 retry)
    const calendarResponse = await OAuthTokenManager.makeAuthenticatedRequest(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${meeting.calendar_event_id}?sendUpdates=all`,
      {
        method: 'DELETE',
      },
      accessToken,
      refreshToken
    );

    // Allow 404/410 (already deleted) as success cases
    if (!calendarResponse.ok && calendarResponse.status !== 410 && calendarResponse.status !== 404) {
      const errorText = await calendarResponse.text();
      console.error('Failed to cancel calendar event:', calendarResponse.status, errorText);
      throw new Error(`Failed to cancel Google Calendar event: ${calendarResponse.status}`);
    }

    // Update meeting status
    const { error: updateError } = await (supabase
      .from('meetings') as any)
      .update({ status: 'cancelled' })
      .eq('id', meetingId)
      .eq('user_id', user.id);

    if (updateError) {
      throw updateError;
    }

    // Log analytics with detailed information
    try {
      await supabase.from('meeting_analytics').insert({
        meeting_id: meetingId,
        user_id: user.id,
        event_type: 'meeting_cancelled',
        event_data: {
          calendar_event_id: meeting.calendar_event_id,
          meeting_title: meeting.summary,
          attendee_count: Array.isArray(meeting.attendees) ? meeting.attendees.length : 0,
          was_scheduled: meeting.status === 'scheduled',
          cancellation_source: 'edge_function',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (analyticsError) {
      console.error('Analytics logging error:', analyticsError);
      // Don't fail the request if analytics fails
    }

    console.log('Meeting cancelled:', meetingId);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Meeting cancelled successfully',
        meeting_id: meetingId,
        calendar_cancelled: calendarResponse.ok || calendarResponse.status === 410 || calendarResponse.status === 404,
      }),
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
