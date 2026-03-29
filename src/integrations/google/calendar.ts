import { SUPABASE_URL, supabase } from "@/integrations/supabase/client";
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

interface TokenStatusResponse {
  success: boolean;
  tokenStatus?: {
    hasTokens: boolean;
    isExpired: boolean;
    isValid: boolean;
  };
  error?: string;
}

class GoogleCalendarService {
  // User-scoped cache to prevent serving stale sessions across different users
  private sessionCache: Map<string, { session: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5000; // 5 seconds
  // Prevent race conditions in concurrent token requests
  private pendingTokenFetches: Map<string, Promise<string>> = new Map();
  private getSupabaseFunctionsUrl(path: string): string {
    if (!SUPABASE_URL) {
      throw new Error('Missing required environment variable: VITE_SUPABASE_URL. Please update your .env file.');
    }

    return `${SUPABASE_URL}/functions/v1/${path}`;
  }

  private async getTokenStatus(): Promise<TokenStatusResponse> {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return { success: false, error: 'No active session' };
    }

    const response = await fetch(this.getSupabaseFunctionsUrl('get-token-status'), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Failed to fetch token status (${response.status}): ${errText}`);
    }

    return response.json();
  }

  private async getAccessToken(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    if (!userId) {
      throw new Error('No authenticated user');
    }

    const existingRequest = this.pendingTokenFetches.get(userId);
    if (existingRequest) {
      return existingRequest;
    }

    const tokenPromise = this.fetchFreshToken(userId);
    this.pendingTokenFetches.set(userId, tokenPromise);

    try {
      return await tokenPromise;
    } finally {
      this.pendingTokenFetches.delete(userId);
    }
  }

  private async fetchFreshToken(userId: string): Promise<string> {
    const now = Date.now();

    const { data: { session } } = await supabase.auth.getSession();
    this.sessionCache.set(userId, { session, timestamp: now });

    if (!session) {
      throw new Error('No active session. Please sign in.');
    }

    if (session.provider_token) {
      return session.provider_token;
    }

    // Browser only reads token status from backend, never raw token values from metadata.
    const tokenStatus = await this.getTokenStatus();
    if (tokenStatus.success && tokenStatus.tokenStatus?.hasTokens) {
      logger.log('Backend indicates stored token exists; requesting refresh/sync.');
      await this.refreshAccessToken();

      const { data: { session: refreshedSession } } = await supabase.auth.getSession();
      if (refreshedSession?.provider_token) {
        return refreshedSession.provider_token;
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    const googleIdentity = user?.identities?.find(identity => identity.provider === 'google');
    if (!googleIdentity) {
      throw new Error('No Google account linked. Please sign in with Google.');
    }

    throw new Error('Google Calendar access token expired. Please reconnect your Google account.');
  }

  /**
   * Refresh the access token by calling the backend Edge Function
   */
  private async refreshAccessToken(): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No session found');
      }

      const response = await fetch(this.getSupabaseFunctionsUrl('refresh-google-token'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Token refresh failed:', response.status, errorText);
        throw new Error(`Failed to refresh token: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Token refresh failed');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        this.sessionCache.delete(user.id);
        this.pendingTokenFetches.delete(user.id);
      }

      const { error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        logger.error('Failed to refresh Supabase session:', refreshError);
      } else {
        logger.log('Supabase session refreshed successfully');
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      logger.log('Access token refreshed and synchronized successfully');
    } catch (error: any) {
      logger.error('Failed to refresh access token:', error);
      throw error;
    }
  }

  /**
   * Clear cache for a specific user (call on logout or auth state change)
   */
  clearUserCache(userId: string): void {
    this.sessionCache.delete(userId);
    this.pendingTokenFetches.delete(userId);
  }

  /**
   * Clear all caches (call on global auth state reset)
   */
  clearAllCaches(): void {
    this.sessionCache.clear();
    this.pendingTokenFetches.clear();
  }

  private async makeCalendarRequest(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<any> {
    const maxRetries = 1;

    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`https://www.googleapis.com/calendar/v3${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      // Handle 401 Unauthorized - token expired
      if (response.status === 401 && retryCount < maxRetries) {
        logger.log('Access token expired, attempting refresh...');

        try {
          // Refresh the token
          await this.refreshAccessToken();

          // Retry the request with new token
          return this.makeCalendarRequest(endpoint, options, retryCount + 1);
        } catch (refreshError: any) {
          logger.error('Token refresh failed:', refreshError);
          throw new Error('Authentication failed. Please reconnect your Google account.');
        }
      }

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

        // Handle 401 errors that weren't retried
        if (response.status === 401) {
          throw new Error('Google Calendar authentication failed. Please reconnect your Google account.');
        }

        throw new Error(`Google Calendar API error: ${errorMessage}`);
      }

      return response.json();
    } catch (error: any) {
      // If this was a retry and it still failed, throw a more specific error
      if (retryCount > 0) {
        throw new Error(`Google Calendar API error after token refresh: ${error.message}`);
      }
      throw error;
    }
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

  async deleteEvent(calendarId: string = 'primary', eventId: string, retryCount = 0): Promise<void> {
    const maxRetries = 1;

    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      // For DELETE requests, 410 Gone means the event is already deleted (success)
      if (response.status === 410 || response.status === 404) {
        logger.log('Calendar event already deleted - treating as success');
        return;
      }

      // Handle 401 Unauthorized - token expired
      if (response.status === 401 && retryCount < maxRetries) {
        logger.log('Access token expired during delete, attempting refresh...');

        try {
          // Refresh the token
          await this.refreshAccessToken();

          // Retry the request with new token
          return this.deleteEvent(calendarId, eventId, retryCount + 1);
        } catch (refreshError: any) {
          logger.error('Token refresh failed during delete:', refreshError);
          throw new Error('Authentication failed. Please reconnect your Google account.');
        }
      }

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

        // Handle 401 errors that weren't retried
        if (response.status === 401) {
          throw new Error('Google Calendar authentication failed. Please reconnect your Google account.');
        }

        throw new Error(`Google Calendar API error: ${errorMessage}`);
      }
    } catch (error: any) {
      // If this was a retry and it still failed, throw a more specific error
      if (retryCount > 0) {
        throw new Error(`Google Calendar API error after token refresh: ${error.message}`);
      }
      throw error;
    }
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
      logger.log('Starting calendar access validation...');

      // First check if user has Google OAuth identity
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        logger.log('Calendar validation: Error getting user:', error.message);
        return false;
      }
      if (!user) {
        logger.log('Calendar validation: No user found');
        return false;
      }

      const googleIdentity = user.identities?.find(identity => identity.provider === 'google');
      if (!googleIdentity) {
        logger.log('Calendar validation: No Google identity found for user');
        return false;
      }

      logger.log('Calendar validation: Google identity found, checking backend token status...');
      const tokenStatus = await this.getTokenStatus();
      if (!tokenStatus.success || !tokenStatus.tokenStatus?.hasTokens) {
        logger.log('Calendar validation: backend reports no stored Google tokens');
        return false;
      }

      logger.log('Calendar validation: Session valid, testing calendar API access...');
      await this.listEvents('primary', { maxResults: 1 });
      logger.log('Calendar validation: Access confirmed');
      return true;
    } catch (error) {
      logger.error('Google Calendar access validation failed:', error);
      return false;
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();
