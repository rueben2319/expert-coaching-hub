import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Certificate {
  id: string;
  course_id: string;
  certificate_url: string | null;
  certificate_id: string;
  issued_at: string;
  verification_status: string;
  expires_at: string | null;
  courses: {
    id: string;
    title: string;
    thumbnail_url: string | null;
  };
}

export function useUserCertificates(userId?: string) {
  return useQuery<Certificate[]>({
    queryKey: ["user-certificates", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_certificates")
        .select(`
          id,
          course_id,
          certificate_url,
          certificate_id,
          issued_at,
          verification_status,
          expires_at,
          courses(
            id,
            title,
            thumbnail_url
          )
        `)
        .eq("user_id", userId!)
        .order("issued_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as Certificate[];
    },
    enabled: !!userId,
  });
}
