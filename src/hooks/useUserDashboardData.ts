import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UpcomingLesson {
  id: string;
  title: string;
  description: string | null;
  estimated_duration: number | null;
  order_index: number;
  courses: {
    id: string;
    title: string;
  };
  course_modules: {
    id: string;
    title: string;
  };
  lesson_progress: {
    progress_percentage: number;
    started_at: string | null;
  } | null;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned_at: string;
  type: 'badge' | 'certificate' | 'achievement';
}

export function useUserAchievements(userId?: string) {
  // Since achievements/badges are not in the current schema, 
  // this is a placeholder for future implementation
  return useQuery<Achievement[]>({
    queryKey: ["user-achievements", userId],
    queryFn: async () => {
      // For now, return empty array - this can be enhanced when
      // achievements/badges tables are added to the schema
      return [];
    },
    enabled: !!userId,
  });
}

export function useUpcomingLessons(userId?: string, limit: number = 5) {
  return useQuery<UpcomingLesson[]>({
    queryKey: ["upcoming-lessons", userId, limit],
    queryFn: async () => {
      // First get lesson progress records for this user that are not completed
      const { data: progressData, error: progressError } = await supabase
        .from("lesson_progress")
        .select("lesson_id, progress_percentage, started_at")
        .eq("user_id", userId!)
        .lt("progress_percentage", 100)
        .order("progress_percentage", { ascending: false })
        .limit(limit);

      if (progressError) throw progressError;
      
      if (!progressData || progressData.length === 0) return [];

      // Get the lesson IDs
      const lessonIds = progressData.map(p => p.lesson_id);

      // Then get the full lesson details
      const { data, error } = await supabase
        .from("lessons")
        .select(`
          id,
          title,
          description,
          estimated_duration,
          order_index,
          courses(
            id,
            title
          ),
          course_modules(
            id,
            title
          )
        `)
        .in("id", lessonIds);

      if (error) throw error;

      // Combine the data
      const lessonsWithProgress = (data as UpcomingLesson[]).map(lesson => {
        const progress = progressData.find(p => p.lesson_id === lesson.id);
        return {
          ...lesson,
          lesson_progress: progress ? {
            progress_percentage: progress.progress_percentage,
            started_at: progress.started_at
          } : null
        };
      });

      // Sort by progress percentage (highest first)
      return lessonsWithProgress.sort((a, b) => 
        (b.lesson_progress?.progress_percentage || 0) - (a.lesson_progress?.progress_percentage || 0)
      );
    },
    enabled: !!userId,
  });
}
