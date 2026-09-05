import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LessonProgressRecord {
  lesson_id: string;
  progress_percentage: number;
  completed_at: string | null;
}

export interface LessonRef {
  id: string;
}

export interface CourseModuleRef {
  id: string;
  lessons?: LessonRef[];
}

export interface CourseRef {
  id: string;
  title: string;
  description: string | null;
  course_modules?: CourseModuleRef[];
}

export interface CourseCardViewModel {
  enrollmentId: string;
  courseId: string;
  title: string;
  description: string;
  progress: number;
  level: string | null;
  category: string | null;
}

export function calculateProgressFromModules(
  modules: CourseModuleRef[] | undefined,
  completedLessonIds: Set<string>,
): number {
  if (!modules || modules.length === 0) return 0;

  const moduleProgresses = modules.map((module) => {
    const lessons = module.lessons ?? [];
    if (lessons.length === 0) return 0;

    const completedLessons = lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;
    return (completedLessons / lessons.length) * 100;
  });

  const averageProgress =
    moduleProgresses.reduce((sum, moduleProgress) => sum + moduleProgress, 0) / modules.length;

  return Math.round(averageProgress);
}

export function useEnrollmentProgress(userId?: string) {
  const {
    data: lessonProgress,
    isLoading,
    error,
  } = useQuery<LessonProgressRecord[]>({
    queryKey: ["enrollment-progress", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_progress")
        .select("lesson_id, progress_percentage, completed_at")
        .eq("user_id", userId!);

      if (error) throw error;
      return data as LessonProgressRecord[];
    },
    enabled: !!userId,
  });

  const completedLessonIds = useMemo(() => {
    const ids = new Set<string>();
    lessonProgress?.forEach((lesson) => {
      // Consider a lesson completed if progress is 100% or has a completed_at timestamp
      if (lesson.progress_percentage === 100 || lesson.completed_at) {
        ids.add(lesson.lesson_id);
      }
    });
    return ids;
  }, [lessonProgress]);

  const calculateCourseProgress = useCallback(
    (course: { course_modules?: CourseModuleRef[] }): number =>
      calculateProgressFromModules(course.course_modules, completedLessonIds),
    [completedLessonIds],
  );

  const calculateEnrollmentProgress = useCallback(
    (enrollment: { courses: { course_modules?: CourseModuleRef[] } }): number =>
      calculateProgressFromModules(enrollment.courses.course_modules, completedLessonIds),
    [completedLessonIds],
  );

  return {
    lessonProgress,
    completedLessonIds,
    calculateCourseProgress,
    calculateEnrollmentProgress,
    isLoading,
    error,
  };
}
