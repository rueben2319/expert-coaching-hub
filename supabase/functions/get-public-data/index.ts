// @ts-ignore: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Deno global type declaration for IDE
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  level: 'introduction' | 'intermediate' | 'advanced';
  tag: string | null;
  category: string | null;
  price_credits: number;
  is_free: boolean;
  created_at: string;
  coach_id: string;
  profiles?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

interface Coach {
  id: string;
  full_name: string;
  avatar_url: string | null;
  course_count: number;
}

interface Testimonial {
  id: string;
  name: string;
  role: string;
  content: string;
  rating: number;
  course_title: string;
}

interface ResponseData {
  courses: (Course & { student_count: number; coach_name: string; coach_avatar: string | null })[];
  coaches: Coach[];
  testimonials: Testimonial[];
  stats: {
    total_courses: number;
    total_coaches: number;
    total_students: number;
  };
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
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Fetch published courses
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select(`
        id,
        title,
        description,
        thumbnail_url,
        level,
        tag,
        category,
        price_credits,
        is_free,
        created_at,
        coach_id
      `)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(12)

    if (coursesError) {
      console.error('Error fetching courses:', coursesError)
      throw coursesError
    }

    // Get unique coach IDs and fetch their profiles
    const coachIds = [...new Set(courses.map((c: any) => c.coach_id))]
    const { data: coachProfiles } = await supabase
      .from('profiles_public')
      .select('id, full_name, avatar_url')
      .in('id', coachIds)

    const profileMap = new Map((coachProfiles || []).map((p: any) => [p.id, p]))

    // Fetch enrollment counts for each course
    const coursesWithStats = await Promise.all(
      courses.map(async (course: any) => {
        const { data: enrollments, error: enrollError } = await supabase
          .from('course_enrollments')
          .select('id')
          .eq('course_id', course.id)

        const profile = profileMap.get(course.coach_id)
        return {
          ...course,
          student_count: enrollError ? 0 : enrollments?.length || 0,
          coach_name: profile?.full_name || 'Expert Coach',
          coach_avatar: profile?.avatar_url || null
        }
      })
    )

    // Fetch top coaches (those with published courses)
    const { data: coaches, error: coachesError } = await supabase
      .from('courses')
      .select(`
        coach_id,
        profiles!courses_coach_id_fkey (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('status', 'published')
      .limit(10)

    if (coachesError) {
      console.error('Error fetching coaches:', coachesError)
      throw coachesError
    }

    // Aggregate coach data and count their courses
    const coachMap = new Map()
    coaches.forEach((item: any) => {
      const coach = item.profiles
      if (coach && coach.id) {
        if (!coachMap.has(coach.id)) {
          coachMap.set(coach.id, {
            ...coach,
            course_count: 0
          })
        }
        coachMap.get(coach.id).course_count++
      }
    })

    const uniqueCoaches = Array.from(coachMap.values()).slice(0, 6)

    // Fetch testimonials/reviews (for now, we'll use sample data)
    // In a real implementation, you'd have a reviews table
    const testimonials: Testimonial[] = [
      {
        id: "t1",
        name: "Sarah Chen",
        role: "Product Manager",
        content: "The coaching program transformed my career. The practical insights and personalized guidance helped me land my dream job.",
        rating: 5,
        course_title: "Product Management Mastery"
      },
      {
        id: "t2", 
        name: "Michael Rodriguez",
        role: "Marketing Director",
        content: "Outstanding experience! The coaches are industry experts who truly care about your success.",
        rating: 5,
        course_title: "Growth Marketing Strategies"
      },
      {
        id: "t3",
        name: "Emily Watson",
        role: "Startup Founder",
        content: "The knowledge and skills I gained were immediately applicable to my business. Highly recommend!",
        rating: 4,
        course_title: "Leadership Excellence"
      }
    ]

    const response: ResponseData = {
      courses: coursesWithStats,
      coaches: uniqueCoaches,
      testimonials,
      stats: {
        total_courses: coursesWithStats.length,
        total_coaches: uniqueCoaches.length,
        total_students: coursesWithStats.reduce((sum: number, course: any) => sum + course.student_count, 0)
      }
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error('Error in get-public-data function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
