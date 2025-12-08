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

// Import Google Calendar service inline to avoid path issues
const googleCalendarService = {
  createMeetingWithGoogleMeet: async (data: {
    summary: string;
    description: string;
    startTime: string;
    endTime: string;
    attendeeEmails: string[];
  }) => {
    // This would be implemented with Google Calendar API
    // For now, return a mock response
    return {
      id: `event_${Date.now()}`,
      hangoutLink: `https://meet.google.com/${Math.random().toString(36).substring(2, 12)}`,
    };
  },
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the request body
    const { lessonId, meetingContent } = await req.json()

    if (!lessonId || !meetingContent) {
      return new Response(
        JSON.stringify({ error: 'Missing lessonId or meetingContent' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the lesson and course info to find enrolled students
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select(`
        *,
        course_modules!inner(
          *,
          courses!inner(
            *,
            profiles!inner(
              email
            )
          )
        )
      `)
      .eq('id', lessonId)
      .single()

    if (lessonError || !lesson) {
      return new Response(
        JSON.stringify({ error: 'Lesson not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const course = lesson.course_modules.courses
    const coachEmail = course.profiles.email

    // Get enrolled students for the course
    const { data: enrollments, error: enrollmentError } = await supabase
      .from('course_enrollments')
      .select(`
        user_id,
        profiles!inner(
          email
        )
      `)
      .eq('course_id', course.id)
      .eq('status', 'active')

    if (enrollmentError) {
      return new Response(
        JSON.stringify({ error: 'Failed to get enrolled students' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare attendee emails
    const attendeeEmails = [
      coachEmail,
      ...(enrollments?.map((e: any) => e.profiles.email) || [])
    ]

    // Create Google Calendar event
    const calendarEvent = await googleCalendarService.createMeetingWithGoogleMeet({
      summary: meetingContent.title,
      description: meetingContent.description || '',
      startTime: meetingContent.startTime,
      endTime: meetingContent.endTime,
      attendeeEmails,
    })

    // Create meeting record
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .insert({
        user_id: user.id,
        summary: meetingContent.title,
        description: meetingContent.description || null,
        start_time: meetingContent.startTime,
        end_time: meetingContent.endTime,
        attendees: attendeeEmails,
        status: 'scheduled',
        meet_link: calendarEvent.hangoutLink,
        calendar_event_id: calendarEvent.id,
        lesson_id: lessonId, // Link to the lesson
      })
      .select()
      .single()

    if (meetingError) {
      return new Response(
        JSON.stringify({ error: 'Failed to create meeting', details: meetingError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log analytics
    await supabase.from('meeting_analytics').insert({
      meeting_id: meeting.id,
      user_id: user.id,
      event_type: 'meeting_created',
      event_data: {
        lesson_id: lessonId,
        course_id: course.id,
        attendee_count: attendeeEmails.length,
        created_via: 'lesson_content',
      },
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        meeting: {
          id: meeting.id,
          title: meeting.summary,
          startTime: meeting.start_time,
          endTime: meeting.end_time,
          meetLink: meeting.meet_link,
          attendeeCount: attendeeEmails.length,
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: unknown) {
    console.error('Error creating lesson meeting:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
