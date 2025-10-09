import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Clock, TrendingUp, Calendar, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { clientNavItems, clientSidebarSections } from "@/config/navigation";

export default function Courses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: courses, isLoading } = useQuery({
    queryKey: ["published-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          *,
          course_enrollments!left(*)
        `)
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const enrollMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase
        .from("course_enrollments")
        .insert({
          user_id: user!.id,
          course_id: courseId,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["published-courses"] });
      queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });
      toast({ title: "Enrolled successfully!" });
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast({ title: "Already enrolled", variant: "destructive" });
      } else {
        toast({ title: "Failed to enroll", variant: "destructive" });
      }
    },
  });

  const isEnrolled = (course: any) => {
    return course.course_enrollments?.some((e: any) => e.user_id === user?.id);
  };

  return (
    <DashboardLayout navItems={clientNavItems} sidebarSections={clientSidebarSections}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Browse Courses</h1>
          <p className="text-muted-foreground mt-2">
            Discover and enroll in courses
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading courses...</div>
        ) : courses && courses.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card key={course.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                  <CardDescription className="line-clamp-3">
                    {course.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {isEnrolled(course) ? (
                      <Button
                        className="w-full"
                        onClick={() => navigate(`/client/course/${course.id}`)}
                      >
                        Continue Learning
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => enrollMutation.mutate(course.id)}
                        disabled={enrollMutation.isPending}
                      >
                        {enrollMutation.isPending ? "Enrolling..." : "Enroll Now"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No courses available</h3>
              <p className="text-muted-foreground">
                Check back later for new courses
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
