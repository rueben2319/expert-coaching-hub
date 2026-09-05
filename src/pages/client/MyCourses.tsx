import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import { clientSidebarSections } from "@/config/navigation";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useEnrollmentProgress, type CourseCardViewModel, type CourseModuleRef } from "@/hooks/useEnrollmentProgress";
import { useUserCertificates } from "@/hooks/useUserCertificates";
import { useUpcomingLessons, type UpcomingLesson } from "@/hooks/useUserDashboardData";
import { EnhancedCourseCard } from "@/components/dashboard/EnhancedCourseCard";
import { AchievementsSection } from "@/components/dashboard/AchievementsSection";
import { UpcomingLessonsSection } from "@/components/dashboard/UpcomingLessonsSection";

type MyCourseEnrollment = {
  id: string;
  courses: {
    id: string;
    title: string;
    description: string | null;
    level: string | null;
    category: string | null;
    course_modules?: CourseModuleRef[];
  };
};

export default function MyCourses() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery<MyCourseEnrollment[]>({
    queryKey: ["my-enrollments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_enrollments")
        .select(`
          id,
          courses(
            id, title, description, level, category,
            course_modules(
              id,
              lessons(id)
            )
          )
        `)
        .eq("user_id", user!.id)
        .order("enrolled_at", { ascending: false });

      if (error) throw error;
      return data as unknown as MyCourseEnrollment[];
    },
    enabled: !!user?.id,
  });

  const { calculateEnrollmentProgress, isLoading: progressLoading } = useEnrollmentProgress(user?.id);
  const { data: certificates, isLoading: certificatesLoading } = useUserCertificates(user?.id);
  const { data: upcomingLessons, isLoading: upcomingLessonsLoading } = useUpcomingLessons(user?.id, 3);

  const cards = useMemo<CourseCardViewModel[]>(() => {
    if (!enrollments) return [];

    return enrollments.map((enrollment) => ({
      enrollmentId: enrollment.id,
      courseId: enrollment.courses.id,
      title: enrollment.courses.title,
      description: enrollment.courses.description ?? "Keep making progress on this course.",
      progress: calculateEnrollmentProgress(enrollment),
      level: enrollment.courses.level,
      category: enrollment.courses.category,
    }));
  }, [enrollments, calculateEnrollmentProgress]);

  const isLoading = enrollmentsLoading || progressLoading || certificatesLoading || upcomingLessonsLoading;

  const handleContinueLesson = (lessonId: string, courseId: string) => {
    navigate(`/client/course/${courseId}#lesson-${lessonId}`);
  };

  return (
    <DashboardLayout sidebarSections={clientSidebarSections}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Learning</h1>
          <p className="text-muted-foreground mt-2">Track your learning progress and achievements</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading your learning dashboard...</div>
        ) : cards.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Content: In-Progress Courses */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">In-Progress</h2>
                <div className="grid gap-6 md:grid-cols-2">
                  {cards.map((card) => (
                    <EnhancedCourseCard
                      key={card.enrollmentId}
                      card={card}
                      onContinue={(courseId) => navigate(`/client/course/${courseId}`)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar: Achievements and Upcoming */}
            <div className="space-y-6">
              <AchievementsSection 
                certificates={certificates || []}
                isLoading={certificatesLoading}
              />
              <UpcomingLessonsSection
                upcomingLessons={upcomingLessons || []}
                isLoading={upcomingLessonsLoading}
                onContinueLesson={handleContinueLesson}
              />
            </div>
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No enrolled courses</h3>
              <p className="text-muted-foreground mb-4">Start learning by enrolling in a course</p>
              <Button onClick={() => navigate("/client/courses")}>Browse Courses</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
