import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MeetingRequest {
  summary: string;
  description?: string;
  startTime: string;
  endTime: string;
  attendees: string[];
  courseId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
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

    const body: MeetingRequest = await req.json();
    const { summary, description, startTime, endTime, attendees, courseId } = body;

    // Get Google OAuth token from user's identities
    const { data: identities } = await supabase
      .from('auth.identities')
      .select('provider_token, provider_refresh_token')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .single();

    if (!identities?.provider_token) {
      throw new Error('No Google OAuth token found. Please sign in with Google again.');
    }

    let accessToken = identities.provider_token;

    // Create Google Calendar event with Meet link
    const requestId = crypto.randomUUID();
    const calendarResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary,
          description,
          start: {
            dateTime: startTime,
            timeZone: 'UTC',
          },
          end: {
            dateTime: endTime,
            timeZone: 'UTC',
          },
          attendees: attendees.map(email => ({ email })),
          conferenceData: {
            createRequest: {
              requestId,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
          sendUpdates: 'all',
        }),
      }
    );

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text();
      console.error('Google Calendar API error:', errorText);
      throw new Error(`Failed to create calendar event: ${errorText}`);
    }

    const calendarEvent = await calendarResponse.json();
    const meetLink = calendarEvent.conferenceData?.entryPoints?.find(
      (ep: any) => ep.entryPointType === 'video'
    )?.uri;

    // Store meeting in database
    const { data: meeting, error: dbError } = await supabase
      .from('meetings')
      .insert({
        user_id: user.id,
        course_id: courseId || null,
        summary,
        description,
        meet_link: meetLink,
        calendar_event_id: calendarEvent.id,
        start_time: startTime,
        end_time: endTime,
        attendees: attendees,
        status: 'scheduled',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

    // Log analytics event
    await supabase.from('meeting_analytics').insert({
      meeting_id: meeting.id,
      user_id: user.id,
      event_type: 'meeting_created',
      event_data: {
        attendee_count: attendees.length,
        course_id: courseId,
      },
    });

    console.log('Meeting created successfully:', meeting.id);

    return new Response(
      JSON.stringify({
        success: true,
        meeting: {
          id: meeting.id,
          meetLink,
          calendarEventId: calendarEvent.id,
          summary,
          startTime,
          endTime,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating meeting:', error);
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
