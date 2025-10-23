import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Clock, TrendingUp, Calendar, User, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { clientNavItems, clientSidebarSections } from "@/config/navigation";
import { useCredits } from "@/hooks/useCredits";
import { CreditWallet } from "@/components/CreditWallet";

export default function Courses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enrollWithCredits, balance } = useCredits();

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

  // Free enrollment mutation (for free courses)
  const enrollMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase
        .from("course_enrollments")
        .insert({
          user_id: user!.id,
          course_id: courseId,
          payment_status: "free",
          credits_paid: 0,
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

  const handleEnrollClick = (course: any) => {
    if (isEnrolled(course)) {
      navigate(`/client/course/${course.id}`);
      return;
    }

    // Check if course is free or paid
    const isFree = course.is_free || !course.price_credits || course.price_credits === 0;
    
    if (isFree) {
      // Free enrollment
      enrollMutation.mutate(course.id);
    } else {
      // Check if user has enough credits
      if (balance < course.price_credits) {
        toast({ 
          title: "Insufficient credits", 
          description: `You need ${course.price_credits} credits. Buy more credits to enroll.`,
          variant: "destructive" 
        });
        return;
      }
      // Paid enrollment with credits
      enrollWithCredits.mutate(course.id);
    }
  };

  return (
    <DashboardLayout navItems={clientNavItems} sidebarSections={clientSidebarSections}>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Browse Courses</h1>
            <p className="text-muted-foreground mt-2">
              Discover and enroll in courses
            </p>
          </div>
          <CreditWallet compact />
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading courses...</div>
        ) : courses && courses.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card key={course.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex gap-2">
                      {course.level && (
                        <Badge variant="outline" className="capitalize">
                          {course.level}
                        </Badge>
                      )}
                      {course.is_free || !course.price_credits || course.price_credits === 0 ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          Free
                        </Badge>
                      ) : (
                        <Badge variant="default" className="flex items-center gap-1">
                          <Coins className="h-3 w-3" />
                          {course.price_credits} Credits
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                  <CardDescription className="line-clamp-3">
                    {course.description}
                  </CardDescription>
                  <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                    {course.category && (
                      <span>
                        <span className="font-medium">Category:</span> {course.category}
                      </span>
                    )}
                    {course.tag && (
                      <span>
                        <span className="font-medium">Tag:</span> {course.tag}
                      </span>
                    )}
                  </div>
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
                        disabled={enrollMutation.isPending || enrollWithCredits.isPending}
                      >
                        {(enrollMutation.isPending || enrollWithCredits.isPending) ? "Enrolling..." : 
                         (course.is_free || !course.price_credits || course.price_credits === 0) ? "Enroll Free" : 
                         `Enroll for ${course.price_credits} Credits`}
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
