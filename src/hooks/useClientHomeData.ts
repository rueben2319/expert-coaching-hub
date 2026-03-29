import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollmentProgress, type CourseModuleRef } from "@/hooks/useEnrollmentProgress";

export type Enrollment = {
  id: string;
  progress_percentage: number;
  enrolled_at: string;
  courses: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    course_modules?: CourseModuleRef[];
  };
};

export type EnrichedEnrollment = Enrollment & {
  calculatedProgress: number;
};

export function useClientHomeData(userId?: string) {
  const {
    data: enrollments,
    isLoading: enrollmentsLoading,
    error: enrollmentsError,
  } = useQuery<Enrollment[]>({
    queryKey: ["client-dashboard-enrollments", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_enrollments")
        .select(`
          id, progress_percentage, enrolled_at,
          courses (
            id, title, description, status,
            course_modules (
              id,
              lessons (id)
            )
          )
        `)
        .eq("user_id", userId!)
        .order("enrolled_at", { ascending: false });

      if (error) throw error;
      return data as unknown as Enrollment[];
    },
    enabled: !!userId,
  });

  const {
    lessonProgress,
    calculateEnrollmentProgress,
    isLoading: lessonProgressLoading,
    error: lessonProgressError,
  } = useEnrollmentProgress(userId);

  const enrichedEnrollments = useMemo((): EnrichedEnrollment[] => {
    if (!enrollments) return [];

    return enrollments.map((enrollment) => ({
      ...enrollment,
      calculatedProgress: calculateEnrollmentProgress(enrollment),
    }));
  }, [enrollments, calculateEnrollmentProgress]);

  const upNext = useMemo((): EnrichedEnrollment | undefined => {
    return enrichedEnrollments
      .filter((enrollment) => enrollment.calculatedProgress < 100)
      .sort((a, b) => a.calculatedProgress - b.calculatedProgress)[0];
  }, [enrichedEnrollments]);

  const totalCourses = enrichedEnrollments.length;

  const overallProgress = useMemo(() => {
    if (!enrichedEnrollments.length) return 0;
    const totalProgress = enrichedEnrollments.reduce(
      (sum, enrollment) => sum + enrollment.calculatedProgress,
      0,
    );
    return Math.round(totalProgress / enrichedEnrollments.length);
  }, [enrichedEnrollments]);

  const coursesInProgress = useMemo(
    () => enrichedEnrollments.filter((e) => e.calculatedProgress > 0 && e.calculatedProgress < 100),
    [enrichedEnrollments],
  );

  const coursesCompleted = useMemo(
    () => enrichedEnrollments.filter((e) => e.calculatedProgress >= 100),
    [enrichedEnrollments],
  );

  const lessonsCompleted = lessonProgress?.filter((lesson) => lesson.is_completed).length ?? 0;

  const progressSegments = useMemo(() => {
    if (!totalCourses) return [];

    const segments = [
      { label: "In Progress", value: coursesInProgress.length, color: "bg-primary" },
      { label: "Completed", value: coursesCompleted.length, color: "bg-emerald-500" },
      {
        label: "Not Started",
        value: Math.max(totalCourses - coursesInProgress.length - coursesCompleted.length, 0),
        color: "bg-muted-foreground/40",
      },
    ];

    return segments.filter((segment) => segment.value > 0);
  }, [totalCourses, coursesInProgress.length, coursesCompleted.length]);

  return {
    enrollments,
    lessonProgress,
    enrichedEnrollments,
    upNext,
    overallProgress,
    progressSegments,
    totalCourses,
    lessonsCompleted,
    coursesInProgress,
    coursesCompleted,
    hasCourses: enrichedEnrollments.length > 0,
    isLoading: enrollmentsLoading || lessonProgressLoading,
    enrollmentsLoading,
    lessonProgressLoading,
    error: enrollmentsError ?? lessonProgressError,
  };
}
