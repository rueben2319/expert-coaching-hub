// @ts-ignore: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

// Deno global type declaration for IDE
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

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

    // Get user's session to access provider tokens
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.session?.provider_token) {
      throw new Error('No valid Google OAuth session found. Please sign in with Google again.');
    }

    let accessToken = session.session.provider_token;
    const refreshToken = session.session.provider_refresh_token;

    // Helper function to refresh Google OAuth token
    const refreshAccessToken = async (refreshToken: string): Promise<string> => {
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
      
      if (!clientId || !clientSecret) {
        throw new Error('Google OAuth credentials not configured');
      }

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to refresh Google OAuth token');
      }

      const tokenData = await tokenResponse.json();
      return tokenData.access_token;
    };

    // Cancel Google Calendar event with retry logic
    let calendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${meeting.calendar_event_id}?sendUpdates=all`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    // If token expired, try to refresh and retry
    if (calendarResponse.status === 401 && refreshToken) {
      try {
        accessToken = await refreshAccessToken(refreshToken);
        calendarResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${meeting.calendar_event_id}?sendUpdates=all`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );
      } catch (refreshError) {
        throw new Error('Failed to refresh access token. Please re-authenticate with Google.');
      }
    }

    if (!calendarResponse.ok && calendarResponse.status !== 410 && calendarResponse.status !== 404) {
      const errorText = await calendarResponse.text();
      console.error('Failed to cancel calendar event:', calendarResponse.status, errorText);
      throw new Error(`Failed to cancel Google Calendar event: ${calendarResponse.status}`);
    }

    // Update meeting status
    const { error: updateError } = await supabase
      .from('meetings')
      .update({ status: 'cancelled' })
      .eq('id', meetingId);

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
