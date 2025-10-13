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
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Courses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [enrollmentDialog, setEnrollmentDialog] = useState<{
    open: boolean;
    course: any;
  }>({ open: false, course: null });

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

  const { data: hasActiveSubscription } = useQuery({
    queryKey: ["has-active-subscription", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_subscriptions")
        .select("status")
        .eq("client_id", user!.id)
        .eq("status", "active")
        .limit(1);

      if (error) throw error;
      return data && data.length > 0;
    },
  });

  const checkCoachSubscription = async (coachId: string) => {
    if (!user?.id) return false;

    const { data, error } = await supabase
      .from("client_subscriptions")
      .select(`
        status,
        coach_packages!inner(coach_id)
      `)
      .eq("client_id", user.id)
      .eq("status", "active")
      .eq("coach_packages.coach_id", coachId)
      .limit(1);

    if (error) return false;
    return data && data.length > 0;
  };

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

  const handleEnrollClick = async (course: any) => {
    if (isEnrolled(course)) {
      navigate(`/client/course/${course.id}`);
      return;
    }

    // Check if user has subscription with this specific coach
    const hasCoachSubscription = await checkCoachSubscription(course.coach_id);

    if (hasCoachSubscription) {
      // User has subscription with this coach, enroll directly
      enrollMutation.mutate(course.id);
    } else {
      // User doesn't have subscription with this coach, show payment options
      setEnrollmentDialog({ open: true, course });
    }
  };

  const handleOneTimePayment = async (course: any) => {
    // TODO: Implement one-time payment for course
    toast({ title: "One-time payment coming soon!", description: "This feature is not yet implemented." });
    setEnrollmentDialog({ open: false, course: null });
  };

  const handleSubscribeToCoach = () => {
    // Navigate to packages page, but ideally filter by the coach
    navigate("/client/packages");
    setEnrollmentDialog({ open: false, course: null });
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
                        onClick={() => handleEnrollClick(course)}
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

      {/* Enrollment Options Dialog */}
      <Dialog open={enrollmentDialog.open} onOpenChange={(open) => setEnrollmentDialog({ open, course: open ? enrollmentDialog.course : null })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Access This Course</DialogTitle>
            <DialogDescription>
              To enroll in "{enrollmentDialog.course?.title}", choose how you'd like to access this course.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <Button
                variant="outline"
                onClick={() => handleOneTimePayment(enrollmentDialog.course)}
                className="h-auto p-4 flex flex-col items-start space-y-2"
              >
                <div className="font-semibold">Pay for This Course Only</div>
                <div className="text-sm text-muted-foreground text-left">
                  One-time payment to access this specific course permanently
                </div>
                <div className="text-sm font-medium text-orange-600">Coming Soon</div>
              </Button>

              <Button
                onClick={handleSubscribeToCoach}
                className="h-auto p-4 flex flex-col items-start space-y-2"
              >
                <div className="font-semibold">Subscribe to Coach Packages</div>
                <div className="text-sm text-muted-foreground text-left">
                  Get unlimited access to all courses from this coach plus premium coaching services
                </div>
                <div className="text-sm font-medium">View Coach Packages →</div>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
