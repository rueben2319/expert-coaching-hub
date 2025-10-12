// @ts-ignore: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime  
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

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime: string };
  end: { dateTime: string };
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
    }>;
  };
  hangoutLink?: string;
}

serve(async (req: Request) => {
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

    // Validate request body
    if (!summary || !startTime || !endTime || !attendees?.length) {
      throw new Error('Missing required fields: summary, startTime, endTime, and attendees');
    }

    // Validate date format
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date format for startTime or endTime');
    }
    if (startDate >= endDate) {
      throw new Error('Start time must be before end time');
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

      const tokenData: GoogleTokenResponse = await tokenResponse.json();
      return tokenData.access_token;
    };

    // Helper function to make Google Calendar API request with token refresh
    const makeCalendarRequest = async (token: string, attempt = 1): Promise<CalendarEvent> => {
      const requestId = `meet-${Date.now()}-${crypto.randomUUID()}`;
      
      const calendarResponse = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary,
            description,
            start: {
              dateTime: startTime,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            },
            end: {
              dateTime: endTime,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
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

      // Handle token expiration with refresh
      if (calendarResponse.status === 401 && attempt === 1 && refreshToken) {
        console.log('Access token expired, refreshing...');
        const newToken = await refreshAccessToken(refreshToken);
        return makeCalendarRequest(newToken, 2);
      }

      if (!calendarResponse.ok) {
        const errorText = await calendarResponse.text();
        console.error('Google Calendar API error:', errorText);
        throw new Error(`Failed to create calendar event: ${calendarResponse.status} ${errorText}`);
      }

      return await calendarResponse.json();
    };

    // Create the calendar event
    const calendarEvent = await makeCalendarRequest(accessToken);

    // Extract Google Meet link from the response
    const meetLink = calendarEvent.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === 'video'
    )?.uri || calendarEvent.hangoutLink;

    if (!meetLink) {
      console.warn('No Google Meet link found in calendar event response');
    }

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
    const { error: analyticsError } = await (supabase.from('meeting_analytics') as any).insert({
      meeting_id: meeting.id,
      user_id: user.id,
      event_type: 'meeting_created',
      event_data: {
        attendee_count: attendees.length,
        course_id: courseId,
        calendar_event_id: calendarEvent.id,
        has_meet_link: !!meetLink,
        created_via: 'edge_function',
      },
    });

    if (analyticsError) {
      console.error('Failed to log analytics event:', analyticsError);
      // Don't throw here as the meeting was created successfully
    }

    console.log('Meeting created successfully:', meeting.id);

    return new Response(
      JSON.stringify({
        success: true,
        meetingId: meeting.id,
        meetLink: meetLink || null,
        calendarEventId: calendarEvent.id,
        meeting: {
          id: meeting.id,
          summary: meeting.summary,
          description: meeting.description,
          startTime: meeting.start_time,
          endTime: meeting.end_time,
          meetLink: meeting.meet_link,
          status: meeting.status,
          attendees: meeting.attendees,
          courseId: meeting.course_id,
          createdAt: meeting.created_at,
        },
      }),
      { 
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
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
