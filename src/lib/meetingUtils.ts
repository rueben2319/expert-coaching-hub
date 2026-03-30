import { supabase } from "@/integrations/supabase/client";
import { cancelGoogleMeet } from "@/lib/supabaseFunctions";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { logger } from "@/lib/logger";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

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
   * Creates a meeting via the edge function (no client-side Google Calendar)
   */
  static async createMeeting(meetingData: MeetingData): Promise<DatabaseMeeting> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('User not authenticated');
    }

    const validated = MeetingDataSchema.parse(meetingData);
    const sanitizedSummary = validated.summary.trim();
    const sanitizedDescription = validated.description?.trim();

    // Get coach's email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', session.user.id)
      .single();

    if (profileError) throw new Error('Failed to get user profile');

    const allAttendeeEmails = [...new Set([...validated.attendeeEmails, profile.email])];

    // Create via edge function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-google-meet`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: sanitizedSummary,
        description: sanitizedDescription,
        startTime: validated.startTime,
        endTime: validated.endTime,
        attendees: allAttendeeEmails,
        courseId: validated.courseId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Failed to create meeting');

    return result.meeting;
  }

  /**
   * Cancels a meeting
   */
  static async cancelMeeting(meetingId: string): Promise<{
    success: boolean;
    calendarDeleted: boolean;
    dbUpdated: boolean;
    partialFailure: boolean;
    error?: string;
  }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: existingMeeting, error: fetchError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (fetchError || !existingMeeting) throw new Error('Meeting not found');

    let calendarDeleted = false;

    // Try to cancel via edge function if there's a calendar event
    if (existingMeeting.calendar_event_id) {
      try {
        await cancelGoogleMeet({ meetingId, calendarEventId: existingMeeting.calendar_event_id });
        calendarDeleted = true;
      } catch (error: any) {
        logger.warn('Calendar cancellation failed:', error);
      }
    } else {
      calendarDeleted = true;
    }

    // Always update database status
    const { error } = await supabase
      .from('meetings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', meetingId);

    if (error) throw new Error(`Failed to update database: ${error.message}`);

    await this.logAnalyticsEvent(meetingId, user.id, 'meeting_cancelled', {
      calendar_deleted: calendarDeleted,
    });

    return {
      success: true,
      calendarDeleted,
      dbUpdated: true,
      partialFailure: !calendarDeleted && !!existingMeeting.calendar_event_id,
    };
  }

  /**
   * Updates a meeting using the Edge Function
   */
  static async updateMeeting(meetingId: string, updateData: UpdateMeetingData): Promise<DatabaseMeeting> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('User not authenticated');

    let attendeeEmails = updateData.attendeeEmails;
    if (attendeeEmails) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', session.user.id)
        .single();

      if (profile?.email) {
        attendeeEmails = [...new Set([...attendeeEmails, profile.email])];
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
    if (!result.success) throw new Error(result.error || 'Failed to update meeting');

    return result.meeting;
  }

  /**
   * Gets meetings for a user
   */
  static async getUserMeetings(options: {
    status?: string;
    courseId?: string;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<DatabaseMeeting[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    let query = supabase
      .from('meetings')
      .select('*')
      .or(`user_id.eq.${user.id},attendees.cs.["${user.email || ''}"]`);

    if (options.status) query = query.eq('status', options.status);
    if (options.courseId) query = query.eq('course_id', options.courseId);
    if (options.startDate) query = query.gte('start_time', options.startDate);
    if (options.endDate) query = query.lte('end_time', options.endDate);

    query = query.order('start_time', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Logs analytics events
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
        .insert({ meeting_id: meetingId, user_id: userId, event_type: eventType, event_data: eventData });
    } catch (error) {
      logger.error('Failed to log analytics event:', error);
    }
  }

  /**
   * Gets the meet link for a meeting from database
   */
  static async getMeetLink(meetingId: string): Promise<string | null> {
    const { data: meeting, error } = await supabase
      .from('meetings')
      .select('meet_link')
      .eq('id', meetingId)
      .single();

    if (error || !meeting) return null;
    return meeting.meet_link || null;
  }
}

export default MeetingManager;
