import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type CourseRow = Database["public"]["Tables"]["courses"]["Row"];

type CourseWithModules = CourseRow & {
  course_modules: Array<{
    id: string;
    lessons: Array<{ id: string; lesson_content: Array<{ id: string }> | null }> | null;
  }> | null;
};

type EnrollmentWithCourseCoach = Database["public"]["Tables"]["course_enrollments"]["Row"] & {
  courses: { coach_id: string | null };
};

export type CoachDashboardMetrics = {
  courses: number;
  students: number;
  lessons: number;
  earnings: number;
  availableBalance: number;
};

export type UseCoachDashboardDataResult = {
  courses: CourseWithModules[];
  recentCourses: CourseWithModules[];
  metrics: CoachDashboardMetrics;
  isCoursesLoading: boolean;
  isEnrollmentsLoading: boolean;
  isWalletLoading: boolean;
  isKpiLoading: boolean;
  hasCourses: boolean;
  coursesError: Error | null;
  enrollmentsError: Error | null;
  enrollmentsCount: number;
};

export function useCoachDashboardData(): UseCoachDashboardDataResult {
  const { user } = useAuth();
  const { wallet, walletLoading } = useCredits();

  const {
    data: courses = [],
    isLoading: isCoursesLoading,
    error: coursesError,
  } = useQuery<CourseWithModules[], Error>({
    queryKey: ["coach-courses", user?.id],
    throwOnError: false,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          *,
          course_modules(
            id,
            lessons(
              id,
              lesson_content(id)
            )
          )
        `)
        .eq("coach_id", user?.id);

      if (error) {
        console.error("coach dashboard courses query failed", error);
        throw error;
      }

      return (data ?? []) as CourseWithModules[];
    },
    enabled: !!user?.id,
  });

  const {
    data: enrollments = [],
    isLoading: isEnrollmentsLoading,
    error: enrollmentsError,
  } = useQuery<EnrollmentWithCourseCoach[], Error>({
    queryKey: ["coach-enrollments", user?.id],
    throwOnError: false,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_enrollments")
        .select(`
          *,
          courses!inner(coach_id)
        `)
        .eq("courses.coach_id", user?.id);

      if (error) {
        console.error("coach dashboard enrollments query failed", error);
        throw error;
      }

      return (data ?? []) as EnrollmentWithCourseCoach[];
    },
    enabled: !!user?.id,
  });

  const totalLessons = courses.reduce((courseAcc, course) => {
    const courseLessonTotal = course.course_modules?.reduce((moduleAcc, module) => {
      return moduleAcc + (module.lessons?.length ?? 0);
    }, 0) ?? 0;

    return courseAcc + courseLessonTotal;
  }, 0);

  const metrics: CoachDashboardMetrics = {
    courses: courses.length,
    students: enrollments.length,
    lessons: totalLessons,
    earnings: wallet?.total_earned ?? 0,
    availableBalance: wallet?.balance ?? 0,
  };

  return {
    courses,
    recentCourses: courses.slice(0, 3),
    metrics,
    isCoursesLoading,
    isEnrollmentsLoading,
    isWalletLoading: walletLoading,
    isKpiLoading: isCoursesLoading || isEnrollmentsLoading || walletLoading,
    hasCourses: courses.length > 0,
    coursesError,
    enrollmentsError,
    enrollmentsCount: enrollments.length,
  };
}
