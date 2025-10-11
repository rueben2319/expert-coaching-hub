import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpen, TrendingUp, Calendar, User } from "lucide-react";
import { clientNavItems, clientSidebarSections } from "@/config/navigation";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export default function MyCourses() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: enrollments, isLoading } = useQuery({
    queryKey: ["my-enrollments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_enrollments")
        .select(`
          *,
          courses(
            *,
            course_modules(
              *,
              lessons(*)
            )
          )
        `)
        .eq("user_id", user!.id)
        .order("enrolled_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch lesson progress for all enrolled courses
  const { data: allLessonProgress } = useQuery({
    queryKey: ["all-lesson-progress", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_progress")
        .select("*")
        .eq("user_id", user!.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Calculate module-based progress for each enrollment
  const calculateCourseProgress = (enrollment: any) => {
    const modules = enrollment.courses?.course_modules || [];
    if (modules.length === 0) return 0;

    const moduleProgresses = modules.map((module: any) => {
      const completedLessons = module.lessons?.filter((lesson: any) =>
        allLessonProgress?.some((progress: any) =>
          progress.lesson_id === lesson.id && progress.is_completed
        )
      ).length || 0;

      return module.lessons?.length > 0
        ? (completedLessons / module.lessons.length) * 100
        : 0;
    });

    const averageProgress = moduleProgresses.reduce((sum: number, progress: number) => sum + progress, 0) / modules.length;
    return Math.round(averageProgress);
  };

  return (
    <DashboardLayout navItems={clientNavItems} sidebarSections={clientSidebarSections}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Courses</h1>
          <p className="text-muted-foreground mt-2">
            Track your learning progress
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading your courses...</div>
        ) : enrollments && enrollments.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {enrollments.map((enrollment) => {
              const courseProgress = calculateCourseProgress(enrollment);

              return (
                <Card key={enrollment.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="line-clamp-2">{enrollment.courses.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {enrollment.courses.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Progress</span>
                          <span className="font-medium">{courseProgress}%</span>
                        </div>
                        <Progress value={Math.max(courseProgress, 5)} />
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => navigate(`/client/course/${enrollment.courses.id}`)}
                      >
                        {courseProgress === 100 ? "Review" : "Continue"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No enrolled courses</h3>
              <p className="text-muted-foreground mb-4">
                Start learning by enrolling in a course
              </p>
              <Button onClick={() => navigate("/client/courses")}>
                Browse Courses
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
