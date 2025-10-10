/// <reference path="../create-google-meet/types.d.ts" />

// @ts-ignore: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { getValidatedGoogleToken, OAuthTokenManager } from "../_shared/oauth-token-manager.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, PATCH',
};

interface UpdateMeetingRequest {
  meetingId: string;
  summary?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  attendees?: string[];
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

interface GoogleCalendarEvent {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  attendees?: Array<{ email: string }>;
  conferenceData?: {
    createRequest?: {
      requestId: string;
      conferenceSolutionKey: { type: string };
    };
  };
}

interface GoogleCalendarResponse {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string };
  end: { dateTime: string };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
    }>;
  };
  htmlLink: string;
  hangoutLink?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user from auth header so we can forward it
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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
      throw new Error('Invalid authentication token');
    }

    // Parse request body
    const { meetingId, summary, description, startTime, endTime, attendees }: UpdateMeetingRequest = await req.json();

    if (!meetingId) {
      throw new Error('Meeting ID is required');
    }

    // Get existing meeting from database
    const { data: existingMeeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .eq('user_id', user.id)
      .single();

    if (meetingError || !existingMeeting) {
      throw new Error('Meeting not found or access denied');
    }

    if (!existingMeeting.calendar_event_id) {
      throw new Error('Meeting is not linked to a Google Calendar event');
    }

    // Get validated Google OAuth token (with automatic refresh)
    const { accessToken, refreshToken, wasRefreshed } = await getValidatedGoogleToken(supabase);

    if (wasRefreshed) {
      console.log('Token was refreshed for user:', user.id);
    }

    // Helper function to make Google Calendar API requests with automatic token handling
    const makeCalendarRequest = async (method: string, endpoint: string, body?: any): Promise<any> => {
      const response = await OAuthTokenManager.makeAuthenticatedRequest(
        `https://www.googleapis.com/calendar/v3${endpoint}`,
        {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
        },
        accessToken,
        refreshToken
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Calendar API error: ${response.status} ${errorText}`);
      }

      return response.json();
    };

    // Prepare updated event data
    const updatedEventData: Partial<GoogleCalendarEvent> = {};

    if (summary !== undefined) {
      updatedEventData.summary = summary;
    }

    if (description !== undefined) {
      updatedEventData.description = description;
    }

    if (startTime !== undefined) {
      updatedEventData.start = {
        dateTime: startTime,
        timeZone: 'UTC',
      };
    }

    if (endTime !== undefined) {
      updatedEventData.end = {
        dateTime: endTime,
        timeZone: 'UTC',
      };
    }

    if (attendees !== undefined) {
      updatedEventData.attendees = attendees.map(email => ({ email }));
    }

    // Update Google Calendar event
    const updatedCalendarEvent: GoogleCalendarResponse = await makeCalendarRequest(
      'PATCH',
      `/calendars/primary/events/${existingMeeting.calendar_event_id}?conferenceDataVersion=1`,
      updatedEventData
    );

    // Extract Google Meet link
    const meetLink = updatedCalendarEvent.hangoutLink || 
                    updatedCalendarEvent.conferenceData?.entryPoints?.find(
                      ep => ep.entryPointType === 'video'
                    )?.uri || 
                    existingMeeting.meet_link;

    // Prepare database update data
    const dbUpdateData: any = {};

    if (summary !== undefined) {
      dbUpdateData.summary = summary;
    }

    if (description !== undefined) {
      dbUpdateData.description = description;
    }

    if (startTime !== undefined) {
      dbUpdateData.start_time = startTime;
    }

    if (endTime !== undefined) {
      dbUpdateData.end_time = endTime;
    }

    if (attendees !== undefined) {
      dbUpdateData.attendees = attendees;
    }

    if (meetLink) {
      dbUpdateData.meet_link = meetLink;
    }

    dbUpdateData.updated_at = new Date().toISOString();

    // Update meeting in database
    const { data: updatedMeeting, error: updateError } = await supabase
      .from('meetings')
      .update(dbUpdateData)
      .eq('id', meetingId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Database update error:', updateError);
      throw new Error('Failed to update meeting in database');
    }

    // Log analytics event
    try {
      await supabase
        .from('meeting_analytics')
        .insert({
          meeting_id: meetingId,
          user_id: user.id,
          event_type: 'meeting_updated',
          event_data: {
            updated_fields: Object.keys(dbUpdateData).filter(key => key !== 'updated_at'),
            calendar_event_id: existingMeeting.calendar_event_id,
            has_meet_link: !!meetLink,
            attendee_count: attendees?.length || existingMeeting.attendees?.length || 0,
          },
        });
    } catch (analyticsError) {
      console.error('Analytics logging error:', analyticsError);
      // Don't fail the request if analytics fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        meeting: updatedMeeting,
        calendar_event: {
          id: updatedCalendarEvent.id,
          htmlLink: updatedCalendarEvent.htmlLink,
          meetLink: meetLink,
        },
        message: 'Meeting updated successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Update meeting error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to update meeting',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
