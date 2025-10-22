import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
  conferenceData?: {
    createRequest?: {
      requestId: string;
      conferenceSolutionKey: {
        type: 'hangoutsMeet';
      };
    };
  };
}

export interface GoogleCalendarResponse {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  conferenceData?: {
    conferenceId?: string;
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
      label?: string;
    }>;
  };
  htmlLink: string;
  hangoutLink?: string;
}

class GoogleCalendarService {
  private async getAccessToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No active session. Please sign in.');
    }

    // Check for provider token in session
    if (session.provider_token) {
      return session.provider_token;
    }

    // Fallback: check user metadata for Google provider info
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated.');
    }

    // Check if user has Google provider identity
    const googleIdentity = user.identities?.find(identity => identity.provider === 'google');
    if (!googleIdentity) {
      throw new Error('No Google account linked. Please sign in with Google.');
    }

    // If no provider token is available, user needs to re-authenticate with calendar scopes
    throw new Error('Google Calendar access not available. Please reconnect your Google account with calendar permissions.');
  }

  private async makeCalendarRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const accessToken = await this.getAccessToken();
    
    const response = await fetch(`https://www.googleapis.com/calendar/v3${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      const errorMessage = error.error?.message || response.statusText;
      
      // Specific handling for deleted project error
      if (errorMessage.includes('has been deleted') || errorMessage.includes('Project') && response.status === 403) {
        throw new Error('Google Cloud Project has been deleted. Please reconfigure OAuth credentials in Google Cloud Console and update Supabase settings.');
      }
      
      // Specific handling for other 403 errors
      if (response.status === 403) {
        throw new Error(`Google Calendar access denied: ${errorMessage}. Please check OAuth permissions and API quotas.`);
      }
      
      throw new Error(`Google Calendar API error: ${errorMessage}`);
    }

    return response.json();
  }

  async createEvent(calendarId: string = 'primary', event: GoogleCalendarEvent): Promise<GoogleCalendarResponse> {
    return this.makeCalendarRequest(`/calendars/${calendarId}/events?conferenceDataVersion=1&sendUpdates=all`, {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async updateEvent(
    calendarId: string = 'primary', 
    eventId: string, 
    event: Partial<GoogleCalendarEvent>
  ): Promise<GoogleCalendarResponse> {
    return this.makeCalendarRequest(`/calendars/${calendarId}/events/${eventId}?conferenceDataVersion=1`, {
      method: 'PUT',
      body: JSON.stringify(event),
    });
  }

  async deleteEvent(calendarId: string = 'primary', eventId: string): Promise<void> {
    const accessToken = await this.getAccessToken();
    
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // For DELETE requests, 410 Gone means the event is already deleted (success)
      if (response.status === 410) {
        logger.log('Calendar event already deleted (410 Gone) - treating as success');
        return; // Don't throw error for already deleted events
      }

      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      const errorMessage = error.error?.message || response.statusText;
      
      // Specific handling for deleted project error
      if (errorMessage.includes('has been deleted') || errorMessage.includes('Project') && response.status === 403) {
        throw new Error('Google Cloud Project has been deleted. Please reconfigure OAuth credentials in Google Cloud Console and update Supabase settings.');
      }
      
      // Specific handling for other 403 errors
      if (response.status === 403) {
        throw new Error(`Google Calendar access denied: ${errorMessage}. Please check OAuth permissions and API quotas.`);
      }
      
      throw new Error(`Google Calendar API error: ${errorMessage}`);
    }

    // DELETE requests typically don't return a body, so we don't parse JSON
  }

  async getEvent(calendarId: string = 'primary', eventId: string): Promise<GoogleCalendarResponse> {
    return this.makeCalendarRequest(`/calendars/${calendarId}/events/${eventId}`);
  }

  async listEvents(
    calendarId: string = 'primary',
    options: {
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
      singleEvents?: boolean;
      orderBy?: 'startTime' | 'updated';
    } = {}
  ): Promise<{ items: GoogleCalendarResponse[] }> {
    const params = new URLSearchParams();
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    const queryString = params.toString();
    const endpoint = `/calendars/${calendarId}/events${queryString ? `?${queryString}` : ''}`;
    
    return this.makeCalendarRequest(endpoint);
  }

  async createMeetingWithGoogleMeet(meetingData: {
    summary: string;
    description?: string;
    startTime: string;
    endTime: string;
    attendeeEmails: string[];
    timeZone?: string;
  }): Promise<GoogleCalendarResponse> {
    const event: GoogleCalendarEvent = {
      summary: meetingData.summary,
      description: meetingData.description,
      start: {
        dateTime: meetingData.startTime,
        timeZone: meetingData.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: meetingData.endTime,
        timeZone: meetingData.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      attendees: meetingData.attendeeEmails.map(email => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      },
    };

    // Log meeting creation without sensitive data
    logger.log('Creating Google Calendar event:', {
      summary: meetingData.summary,
      attendeeCount: meetingData.attendeeEmails.length,
      startTime: meetingData.startTime,
      endTime: meetingData.endTime,
    });

    return this.createEvent('primary', event);
  }

  // Helper method to check if user has valid Google Calendar access
  async validateAccess(): Promise<boolean> {
    try {
      await this.listEvents('primary', { maxResults: 1 });
      return true;
    } catch (error) {
      logger.error('Google Calendar access validation failed:', error);
      return false;
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();
