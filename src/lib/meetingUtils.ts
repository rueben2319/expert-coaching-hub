import { supabase } from "@/integrations/supabase/client";
import { googleCalendarService } from "@/integrations/google/calendar";
import { cancelGoogleMeet } from "@/lib/supabaseFunctions";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = "https://vbrxgaxjmpwusbbbzzgl.supabase.co";

export interface MeetingData {
  summary: string;
  description?: string;
  startTime: string;
  endTime: string;
  attendeeEmails: string[];
  courseId?: string;
}

export interface UpdateMeetingData {
  summary?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  attendeeEmails?: string[];
  courseId?: string;
}

export type DatabaseMeeting = Database['public']['Tables']['meetings']['Row'];
export type DatabaseMeetingInsert = Database['public']['Tables']['meetings']['Insert'];
export type DatabaseMeetingUpdate = Database['public']['Tables']['meetings']['Update'];

export class MeetingManager {
  /**
   * Creates a meeting with both Google Calendar event and database record
   */
  static async createMeeting(meetingData: MeetingData): Promise<DatabaseMeeting> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      // Get coach's email from profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      if (profileError) {
        throw new Error('Failed to get user profile');
      }

      // Ensure coach's email is included in attendees
      const allAttendeeEmails = [...new Set([...meetingData.attendeeEmails, profile.email])];

      console.log('Meeting creation details:', {
        summary: meetingData.summary,
        originalAttendees: meetingData.attendeeEmails,
        coachEmail: profile.email,
        allAttendees: allAttendeeEmails,
        attendeeCount: allAttendeeEmails.length,
      });

      // Create Google Calendar event with Meet link
      const calendarEvent = await googleCalendarService.createMeetingWithGoogleMeet({
        summary: meetingData.summary,
        description: meetingData.description,
        startTime: meetingData.startTime,
        endTime: meetingData.endTime,
        attendeeEmails: allAttendeeEmails,
      });

      // Extract Google Meet link
      const meetLink = calendarEvent.conferenceData?.entryPoints?.find(
        ep => ep.entryPointType === 'video'
      )?.uri || calendarEvent.hangoutLink;

      // Create database record
      const meetingInsert: DatabaseMeetingInsert = {
        user_id: user.id,
        course_id: meetingData.courseId || null,
        summary: meetingData.summary,
        description: meetingData.description || null,
        meet_link: meetLink || null,
        calendar_event_id: calendarEvent.id,
        start_time: meetingData.startTime,
        end_time: meetingData.endTime,
        attendees: allAttendeeEmails,
        status: 'scheduled',
      };

      const { data: dbMeeting, error } = await supabase
        .from('meetings')
        .insert(meetingInsert)
        .select()
        .single();

      if (error) {
        // If database insert fails, try to clean up the calendar event
        try {
          await googleCalendarService.deleteEvent('primary', calendarEvent.id);
        } catch (cleanupError) {
          console.error('Failed to cleanup calendar event:', cleanupError);
        }
        throw error;
      }

      // Log analytics event
      await this.logAnalyticsEvent(dbMeeting.id, user.id, 'meeting_created', {
        calendar_event_id: calendarEvent.id,
        attendee_count: allAttendeeEmails.length,
      });

      return dbMeeting;
    } catch (error) {
      console.error('Failed to create meeting:', error);
      throw error;
    }
  }


  /**
   * Cancels a meeting in both Google Calendar and database
   * Uses Edge Function for proper OAuth token handling
   */
  static async cancelMeeting(meetingId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get existing meeting
    const { data: existingMeeting, error: fetchError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (fetchError || !existingMeeting) {
      throw new Error('Meeting not found');
    }

    try {
      // Skip Edge function and go directly to Google Calendar API
      // The Edge function appears to have issues, so we'll use the direct approach
      if (existingMeeting.calendar_event_id) {
        try {
          await googleCalendarService.deleteEvent('primary', existingMeeting.calendar_event_id);
        } catch (calendarError: any) {
          console.warn('Calendar deletion failed, but continuing with database update:', calendarError);
          // Don't throw here - we still want to update the database status
        }
      }

      // Update database status to cancelled
      const { error } = await supabase
        .from('meetings')
        .update({ status: 'cancelled' })
        .eq('id', meetingId);

      if (error) throw error;

      // Log analytics event
      await this.logAnalyticsEvent(meetingId, user.id, 'meeting_cancelled');
    } catch (error) {
      console.error('Failed to cancel meeting:', error);
      throw error;
    }
  }

  /**
   * Updates a meeting using the Edge Function
   */
  static async updateMeeting(meetingId: string, updateData: UpdateMeetingData): Promise<DatabaseMeeting> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('User not authenticated');
    }

    try {
      // If attendee emails are being updated, ensure coach's email is included
      let attendeeEmails = updateData.attendeeEmails;
      if (attendeeEmails) {
        // Get coach's email from profile
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', user.id)
            .single();

          if (!profileError && profile.email) {
            attendeeEmails = [...new Set([...attendeeEmails, profile.email])];
          }
        }
      }
      const response = await fetch(`${SUPABASE_URL}/functions/v1/update-google-meet`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingId,
          summary: updateData.summary,
          description: updateData.description,
          startTime: updateData.startTime,
          endTime: updateData.endTime,
          attendees: attendeeEmails,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update meeting');
      }

      return result.meeting;
    } catch (error) {
      console.error('Failed to update meeting:', error);
      throw error;
    }
  }

  /**
   * Gets meetings for a user with optional filtering
   */
  static async getUserMeetings(options: {
    status?: string;
    courseId?: string;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<DatabaseMeeting[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    let query = supabase
      .from('meetings')
      .select('*')
      .or(`user_id.eq.${user.id},attendees.cs.["${user.email || ''}"]`);

    if (options.status) {
      query = query.eq('status', options.status);
    }
    if (options.courseId) {
      query = query.eq('course_id', options.courseId);
    }
    if (options.startDate) {
      query = query.gte('start_time', options.startDate);
    }
    if (options.endDate) {
      query = query.lte('end_time', options.endDate);
    }

    query = query.order('start_time', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;

    return data || [];
  }

  /**
   * Logs analytics events for meetings
   */
  static async logAnalyticsEvent(
    meetingId: string,
    userId: string,
    eventType: 'meeting_created' | 'meeting_joined' | 'meeting_left' | 'join_clicked' | 'chat_message_sent' | 'meeting_cancelled',
    eventData: Record<string, any> = {}
  ): Promise<void> {
    try {
      await supabase
        .from('meeting_analytics')
        .insert({
          meeting_id: meetingId,
          user_id: userId,
          event_type: eventType,
          event_data: eventData,
        });
    } catch (error) {
      console.error('Failed to log analytics event:', error);
      // Don't throw here as analytics failures shouldn't break the main flow
    }
  }

  /**
   * Validates Google Calendar access for the current user
   */
  static async validateGoogleCalendarAccess(): Promise<boolean> {
    try {
      return await googleCalendarService.validateAccess();
    } catch (error) {
      console.error('Google Calendar access validation failed:', error);
      return false;
    }
  }

  /**
   * Gets the Google Meet link for a meeting
   */
  static async getMeetLink(meetingId: string): Promise<string | null> {
    const { data: meeting, error } = await supabase
      .from('meetings')
      .select('meet_link, calendar_event_id')
      .eq('id', meetingId)
      .single();

    if (error || !meeting) {
      return null;
    }

    // If we have a stored meet link, return it
    if (meeting.meet_link) {
      return meeting.meet_link;
    }

    // If we have a calendar event ID, try to fetch the meet link from Google Calendar
    if (meeting.calendar_event_id) {
      try {
        const calendarEvent = await googleCalendarService.getEvent('primary', meeting.calendar_event_id);
        const meetLink = calendarEvent.conferenceData?.entryPoints?.find(
          ep => ep.entryPointType === 'video'
        )?.uri || calendarEvent.hangoutLink;

        // Update the database with the meet link if found
        if (meetLink) {
          await supabase
            .from('meetings')
            .update({ meet_link: meetLink })
            .eq('id', meetingId);
        }

        return meetLink || null;
      } catch (error) {
        console.error('Failed to fetch meet link from Google Calendar:', error);
        return null;
      }
    }

    return null;
  }
}

export default MeetingManager;
