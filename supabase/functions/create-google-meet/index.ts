// @ts-ignore: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime  
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { getValidatedGoogleToken, OAuthTokenManager } from "../_shared/oauth-token-manager.ts";
import { TokenStorage } from "../_shared/token-storage.ts";

// Deno global type declaration for IDE
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface MeetingRequest {
  summary: string;
  description?: string;
  startTime: string;
  endTime: string;
  attendees: string[];
  courseId?: string;
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

// Simple rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitStore.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitStore.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get auth header to forward it to the client
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

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

    // Check rate limit
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), 
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Enforce role: only coaches or admins can create meetings for courses
    const { data: roleRow, error: roleErr } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
    const userRole = roleRow?.role || null;
    if (userRole !== 'coach' && userRole !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: only coaches can create meetings' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body: MeetingRequest = await req.json();
    const { summary, description, startTime, endTime, attendees, courseId } = body;

    // Validate request body
    if (!summary || !startTime || !endTime || !attendees?.length) {
      throw new Error('Missing required fields: summary, startTime, endTime, and attendees');
    }

    // Sanitize inputs
    const sanitizedSummary = summary.trim().substring(0, 200); // Limit length
    const sanitizedDescription = description ? description.trim().substring(0, 1000) : undefined;
    
    // Validate email format for attendees
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = attendees.filter(email => !emailRegex.test(email.trim()));
    if (invalidEmails.length > 0) {
      throw new Error(`Invalid email addresses: ${invalidEmails.join(', ')}`);
    }
    
    const sanitizedAttendees = attendees.map(email => email.trim().toLowerCase());

    // Validate date format
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date format for startTime or endTime');
    }
    if (startDate >= endDate) {
      throw new Error('Start time must be before end time');
    }

    // Get validated Google OAuth token (with automatic refresh)
    const { accessToken, refreshToken, wasRefreshed } = await getValidatedGoogleToken(supabase);

    if (wasRefreshed) {
      console.log('Token was refreshed for user:', user.id);
      
      // Store refreshed token analytics
      try {
        await supabase.from('meeting_analytics').insert({
          user_id: user.id,
          event_type: 'token_refreshed',
          event_data: {
            timestamp: new Date().toISOString(),
            refresh_source: 'create_meeting',
            trigger: 'automatic',
          },
        });
      } catch (analyticsError) {
        console.error('Analytics logging error:', analyticsError);
      }
    }

    // Helper function to make Google Calendar API request with automatic token handling
    const makeCalendarRequest = async (): Promise<CalendarEvent> => {
      const requestId = `meet-${Date.now()}-${crypto.randomUUID()}`;
      
      const calendarResponse = await OAuthTokenManager.makeAuthenticatedRequest(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: sanitizedSummary,
            description: sanitizedDescription,
            start: {
              dateTime: startTime,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            },
            end: {
              dateTime: endTime,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            },
            attendees: sanitizedAttendees.map(email => ({ email })),
            conferenceData: {
              createRequest: {
                requestId,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
              },
            },
          }),
        },
        accessToken,
        refreshToken
      );

      if (!calendarResponse.ok) {
        const errorText = await calendarResponse.text();
        console.error('Google Calendar API error:', calendarResponse.status, errorText);
        throw new Error(`Failed to create calendar event: ${calendarResponse.status} ${errorText}`);
      }

      return await calendarResponse.json();
    };

    // Create the calendar event
    const calendarEvent = await makeCalendarRequest();

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
        summary: sanitizedSummary,
        description: sanitizedDescription,
        meet_link: meetLink,
        calendar_event_id: calendarEvent.id,
        start_time: startTime,
        end_time: endTime,
        attendees: sanitizedAttendees,
        status: 'scheduled',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

    // Log analytics event
    try {
      await supabase.from('meeting_analytics').insert({
        meeting_id: meeting.id,
        user_id: user.id,
        event_type: 'meeting_created',
        event_data: {
          attendee_count: sanitizedAttendees.length,
          course_id: courseId,
          calendar_event_id: calendarEvent.id,
          has_meet_link: !!meetLink,
          created_via: 'edge_function',
          token_was_refreshed: wasRefreshed,
        },
      });
    } catch (analyticsError) {
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
