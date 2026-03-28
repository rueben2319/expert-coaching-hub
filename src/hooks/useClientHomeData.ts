import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Enrollment = {
  id: string;
  progress_percentage: number;
  enrolled_at: string;
  courses: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    course_modules?: {
      id: string;
      lessons?: { id: string }[];
    }[];
  };
};

export type EnrichedEnrollment = Enrollment & {
  calculatedProgress: number;
};

export type LessonProgress = {
  id: string;
  lesson_id: string;
  is_completed: boolean;
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
    data: lessonProgress,
    isLoading: lessonProgressLoading,
    error: lessonProgressError,
  } = useQuery<LessonProgress[]>({
    queryKey: ["client-dashboard-lesson-progress", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_progress")
        .select("id, lesson_id, is_completed")
        .eq("user_id", userId!);

      if (error) throw error;
      return data as LessonProgress[];
    },
    enabled: !!userId,
  });

  const lessonProgressById = useMemo(() => {
    const map = new Map<string, boolean>();
    lessonProgress?.forEach((progress) => {
      map.set(progress.lesson_id, progress.is_completed);
    });
    return map;
  }, [lessonProgress]);

  const enrichedEnrollments = useMemo((): EnrichedEnrollment[] => {
    if (!enrollments || !lessonProgress) return [];

    return enrollments.map((enrollment) => {
      const modules = enrollment.courses?.course_modules || [];

      if (modules.length === 0) {
        return {
          ...enrollment,
          calculatedProgress: 0,
        };
      }

      const moduleProgresses = modules.map((module) => {
        const lessonCount = module.lessons?.length || 0;

        if (lessonCount === 0) return 0;

        const completedLessons =
          module.lessons?.filter((lesson) => lessonProgressById.get(lesson.id)).length || 0;

        return (completedLessons / lessonCount) * 100;
      });

      const averageProgress =
        moduleProgresses.reduce((sum, progress) => sum + progress, 0) / modules.length;

      return {
        ...enrollment,
        calculatedProgress: Math.round(averageProgress),
      };
    });
  }, [enrollments, lessonProgress, lessonProgressById]);

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
