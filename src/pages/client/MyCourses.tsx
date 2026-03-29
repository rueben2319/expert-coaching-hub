import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpen } from "lucide-react";
import { clientSidebarSections } from "@/config/navigation";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useEnrollmentProgress, type CourseCardViewModel, type CourseModuleRef } from "@/hooks/useEnrollmentProgress";

type MyCourseEnrollment = {
  id: string;
  courses: {
    id: string;
    title: string;
    description: string | null;
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
            id, title, description,
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

  const cards = useMemo<CourseCardViewModel[]>(() => {
    if (!enrollments) return [];

    return enrollments.map((enrollment) => ({
      enrollmentId: enrollment.id,
      courseId: enrollment.courses.id,
      title: enrollment.courses.title,
      description: enrollment.courses.description ?? "Keep making progress on this course.",
      progress: calculateEnrollmentProgress(enrollment),
    }));
  }, [enrollments, calculateEnrollmentProgress]);

  const isLoading = enrollmentsLoading || progressLoading;

  return (
    <DashboardLayout sidebarSections={clientSidebarSections}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Courses</h1>
          <p className="text-muted-foreground mt-2">Track your learning progress</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading your courses...</div>
        ) : cards.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <Card key={card.enrollmentId} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="line-clamp-2">{card.title}</CardTitle>
                  <CardDescription className="line-clamp-2">{card.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Progress</span>
                        <span className="font-medium">{card.progress}%</span>
                      </div>
                      <Progress value={Math.max(card.progress, 5)} />
                    </div>
                    <Button className="w-full" onClick={() => navigate(`/client/course/${card.courseId}`)}>
                      {card.progress === 100 ? "Review" : "Continue"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
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
