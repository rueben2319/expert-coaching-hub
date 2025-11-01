import { supabase } from "@/integrations/supabase/client";
import { googleCalendarService } from "@/integrations/google/calendar";
import { cancelGoogleMeet } from "@/lib/supabaseFunctions";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { logger } from "@/lib/logger";

// Use environment variable instead of hardcoded URL
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Validation schema for meeting data
const MeetingDataSchema = z.object({
  summary: z.string()
    .min(3, "Summary must be at least 3 characters")
    .max(200, "Summary is too long (max 200 characters)")
    .regex(/^[a-zA-Z0-9\s\-:,.'!?&()]+$/, "Summary contains invalid characters"),
  description: z.string()
    .max(2000, "Description is too long (max 2000 characters)")
    .optional(),
  startTime: z.string().datetime("Invalid start time format"),
  endTime: z.string().datetime("Invalid end time format"),
  attendeeEmails: z.array(
    z.string().email("Invalid email address")
  ).min(1, "At least one attendee is required").max(50, "Too many attendees (max 50)"),
  courseId: z.string().uuid("Invalid course ID").optional(),
}).refine(data => new Date(data.endTime) > new Date(data.startTime), {
  message: "End time must be after start time",
  path: ["endTime"],
});

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
      // Validate and sanitize input data
      const validated = MeetingDataSchema.parse(meetingData);
      
      // Sanitize text fields
      const sanitizedSummary = validated.summary.trim();
      const sanitizedDescription = validated.description?.trim();
      
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
      const allAttendeeEmails = [...new Set([...validated.attendeeEmails, profile.email])];

      logger.log('Meeting creation details:', {
        summary: sanitizedSummary,
        originalAttendees: validated.attendeeEmails,
        coachEmail: profile.email,
        allAttendees: allAttendeeEmails,
        attendeeCount: allAttendeeEmails.length,
      });

      // Create Google Calendar event with Meet link
      const calendarEvent = await googleCalendarService.createMeetingWithGoogleMeet({
        summary: sanitizedSummary,
        description: sanitizedDescription,
        startTime: validated.startTime,
        endTime: validated.endTime,
        attendeeEmails: allAttendeeEmails,
      });

      // Extract Google Meet link
      const meetLink = calendarEvent.conferenceData?.entryPoints?.find(
        ep => ep.entryPointType === 'video'
      )?.uri || calendarEvent.hangoutLink;

      // Create database record with validated and sanitized data
      const meetingInsert: DatabaseMeetingInsert = {
        user_id: user.id,
        course_id: validated.courseId || null,
        summary: sanitizedSummary,
        description: sanitizedDescription || null,
        meet_link: meetLink || null,
        calendar_event_id: calendarEvent.id,
        start_time: validated.startTime,
        end_time: validated.endTime,
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
          logger.error('Failed to cleanup calendar event:', cleanupError);
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
      logger.error('Failed to create meeting:', error);
      throw error;
    }
  }


  /**
   * Cancels a meeting in both Google Calendar and database
   * Returns detailed status about the cancellation operation
   */
  static async cancelMeeting(meetingId: string): Promise<{
    success: boolean;
    calendarDeleted: boolean;
    dbUpdated: boolean;
    partialFailure: boolean;
    error?: string;
  }> {
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

    let calendarDeleted = false;
    let dbUpdated = false;
    let calendarError: Error | null = null;

    // Try to delete from Google Calendar
    if (existingMeeting.calendar_event_id) {
      try {
        await googleCalendarService.deleteEvent('primary', existingMeeting.calendar_event_id);
        calendarDeleted = true;
      } catch (error: any) {
        calendarError = error;
        logger.warn('Calendar deletion failed:', error);
      }
    } else {
      // No calendar event to delete
      calendarDeleted = true;
    }

    // Always update database status
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ 
          status: 'cancelled',
          // Store metadata about the cancellation
          updated_at: new Date().toISOString(),
        })
        .eq('id', meetingId);

      if (error) throw error;
      dbUpdated = true;
    } catch (error: any) {
      throw new Error(`Failed to update database: ${error.message}`);
    }

    // Log analytics with detailed status
    await this.logAnalyticsEvent(meetingId, user.id, 'meeting_cancelled', {
      calendar_deleted: calendarDeleted,
      partial_failure: !calendarDeleted && !!existingMeeting.calendar_event_id,
      calendar_error: calendarError?.message,
    });

    const partialFailure = !calendarDeleted && !!existingMeeting.calendar_event_id;

    return {
      success: dbUpdated,
      calendarDeleted,
      dbUpdated,
      partialFailure,
      error: calendarError?.message,
    };
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
      logger.error('Failed to update meeting:', error);
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
      logger.error('Failed to log analytics event:', error);
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
      logger.error('Google Calendar access validation failed:', error);
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
        logger.error('Failed to fetch meet link from Google Calendar:', error);
        return null;
      }
    }

    return null;
  }
}

export default MeetingManager;
