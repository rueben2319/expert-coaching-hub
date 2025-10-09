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
          courses(*)
        `)
        .eq("user_id", user!.id)
        .order("enrolled_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

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
            {enrollments.map((enrollment) => (
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
                        <span className="font-medium">{enrollment.progress_percentage}%</span>
                      </div>
                      <Progress value={enrollment.progress_percentage} />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => navigate(`/client/course/${enrollment.courses.id}`)}
                    >
                      {enrollment.progress_percentage === 100 ? "Review" : "Continue"}
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
