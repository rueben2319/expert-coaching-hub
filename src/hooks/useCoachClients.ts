import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CoachClient {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  course_id?: string;
  course_title?: string;
  enrollment_date?: string;
}

export const useCoachClients = (courseId?: string) => {
  return useQuery({
    queryKey: ["coach-clients", courseId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (courseId) {
        // Get clients enrolled in specific course
        const { data, error } = await supabase
          .from("course_enrollments")
          .select(`
            user_id,
            enrolled_at,
            course_id,
            courses!inner(
              id,
              title,
              coach_id
            )
          `)
          .eq("courses.coach_id", user.id)
          .eq("course_id", courseId)
          .eq("status", "active");

        if (error) throw error;

        // Get user profiles for the enrolled users
        const userIds = data?.map(enrollment => enrollment.user_id) || [];
        
        if (userIds.length === 0) return [];

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, email, full_name, avatar_url")
          .in("id", userIds);

        if (profilesError) throw profilesError;

        return profiles?.map(profile => {
          const enrollment = data?.find(e => e.user_id === profile.id);
          return {
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name || profile.email,
            avatar_url: profile.avatar_url,
            course_id: courseId,
            course_title: enrollment?.courses.title,
            enrollment_date: enrollment?.enrolled_at,
          };
        }) || [];
      } else {
        // Get all clients enrolled in any of coach's courses
        const { data, error } = await supabase
          .from("course_enrollments")
          .select(`
            user_id,
            course_id,
            enrolled_at,
            courses!inner(
              id,
              title,
              coach_id
            )
          `)
          .eq("courses.coach_id", user.id)
          .eq("status", "active");

        if (error) throw error;

        // Get unique user IDs
        const userIds = [...new Set(data?.map(enrollment => enrollment.user_id) || [])];
        
        if (userIds.length === 0) return [];

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, email, full_name, avatar_url")
          .in("id", userIds);

        if (profilesError) throw profilesError;

        // Remove duplicates and group by user
        const clientsMap = new Map<string, CoachClient>();
        
        profiles?.forEach(profile => {
          const enrollment = data?.find(e => e.user_id === profile.id);
          if (!clientsMap.has(profile.id)) {
            clientsMap.set(profile.id, {
              id: profile.id,
              email: profile.email,
              full_name: profile.full_name || profile.email,
              avatar_url: profile.avatar_url,
              course_id: enrollment?.course_id,
              course_title: enrollment?.courses.title,
              enrollment_date: enrollment?.enrolled_at,
            });
          }
        });

        return Array.from(clientsMap.values());
      }
    },
    enabled: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
