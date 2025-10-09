import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { clientNavItems, clientSidebarSections } from "@/config/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Clock, Play, Sparkles, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Enrollment = {
  id: string;
  progress_percentage: number;
  enrolled_at: string;
  courses: {
    id: string;
    title: string;
    description: string | null;
    status: string;
  };
};

type LessonProgress = {
  id: string;
  lesson_id: string;
  is_completed: boolean;
};

export default function ClientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const {
    data: enrollments,
    isLoading: enrollmentsLoading,
  } = useQuery<Enrollment[]>({
    queryKey: ["client-dashboard-enrollments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_enrollments")
        .select(
          `id, progress_percentage, enrolled_at, courses ( id, title, description, status )`
        )
        .eq("user_id", user!.id)
        .order("enrolled_at", { ascending: false });

      if (error) throw error;
      return data as unknown as Enrollment[];
    },
    enabled: !!user?.id,
  });

  const {
    data: lessonProgress,
    isLoading: lessonProgressLoading,
  } = useQuery<LessonProgress[]>({
    queryKey: ["client-dashboard-lesson-progress", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_progress")
        .select("id, lesson_id, is_completed")
        .eq("user_id", user!.id);

      if (error) throw error;
      return data as LessonProgress[];
    },
    enabled: !!user?.id,
  });

  const upNextCourse = useMemo(() => {
    if (!enrollments) return undefined;
    return enrollments
      .filter((enrollment) => enrollment.progress_percentage < 100)
      .sort((a, b) => a.progress_percentage - b.progress_percentage)[0];
  }, [enrollments]);

  const coursesInProgress = enrollments?.filter((e) => e.progress_percentage > 0 && e.progress_percentage < 100) ?? [];
  const coursesCompleted = enrollments?.filter((e) => e.progress_percentage >= 100) ?? [];
  const totalCourses = enrollments?.length ?? 0;
  const lessonsCompleted = lessonProgress?.filter((l) => l.is_completed).length ?? 0;

  const progressSegments = useMemo(() => {
    if (!totalCourses) return [];
    const segments = [
      { label: "In Progress", value: coursesInProgress.length, color: "bg-primary" },
      { label: "Completed", value: coursesCompleted.length, color: "bg-emerald-500" },
      {
        label: "Not Started",
        value: Math.max(totalCourses - coursesInProgress.length - coursesCompleted.length, 0),
        color: "bg-muted-foreground/40",
      },
    ];
    return segments.filter((segment) => segment.value > 0);
  }, [totalCourses, coursesInProgress.length, coursesCompleted.length]);

  const isLoading = enrollmentsLoading || lessonProgressLoading;
  const hasCourses = !!enrollments && enrollments.length > 0;

  return (
    <DashboardLayout
      navItems={clientNavItems}
      sidebarSections={clientSidebarSections}
      brandName="Experts Coaching Hub"
    >
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Welcome back, {user?.user_metadata?.full_name || "Learner"}
        </h1>
        <p className="text-muted-foreground">Track your learning journey and pick up where you left off.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="bg-card/70 backdrop-blur">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Up next
                </CardTitle>
                <CardDescription>
                  {upNextCourse
                    ? `Continue your progress on ${upNextCourse.courses.title}.`
                    : "No courses in progress yet. Start a new journey today."}
                </CardDescription>
              </div>
              {upNextCourse && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                    <Clock className="h-3 w-3" />
                    Enrolled {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(upNextCourse.enrolled_at))}
                  </Badge>
                  <Badge variant="outline" className="text-xs uppercase">
                    {upNextCourse.courses.status}
                  </Badge>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              {upNextCourse ? (
                <>
                  <div className="space-y-2 max-w-xl">
                    <h2 className="text-2xl font-semibold leading-tight">
                      {upNextCourse.courses.title}
                    </h2>
                    <p className="text-muted-foreground text-sm line-clamp-2">
                      {upNextCourse.courses.description || "Stay engaged and complete your course milestones."}
                    </p>
                    <div className="max-w-md">
                      <Progress value={upNextCourse.progress_percentage} />
                      <p className="text-xs text-muted-foreground mt-1">
                        {Math.round(upNextCourse.progress_percentage)}% complete
                      </p>
                    </div>
                  </div>
                  <Button
                    className="w-full md:w-auto"
                    onClick={() => navigate(`/client/course/${upNextCourse.courses.id}`)}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Continue learning
                  </Button>
                </>
              ) : (
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between w-full">
                  <div>
                    <h2 className="text-2xl font-semibold">Ready to start learning?</h2>
                    <p className="text-muted-foreground text-sm">
                      Browse curated courses and begin your first lesson.
                    </p>
                  </div>
                  <Button className="md:w-auto" onClick={() => navigate(`/client/courses`)}>
                    <Target className="mr-2 h-4 w-4" />
                    Find courses
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Stay on track</h2>
              <Button variant="link" className="p-0 text-sm" onClick={() => navigate(`/client/my-courses`)}>
                View all activities
              </Button>
            </div>

            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map((skeleton) => (
                  <Card key={skeleton} className="animate-pulse">
                    <CardContent className="h-40" />
                  </Card>
                ))}
              </div>
            ) : hasCourses ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {enrollments!.map((enrollment) => (
                  <Card key={enrollment.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-base line-clamp-2">
                        {enrollment.courses.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-2 min-h-[40px]">
                        {enrollment.courses.description || "Keep making progress on this course."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Progress value={enrollment.progress_percentage} />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{Math.round(enrollment.progress_percentage)}% complete</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto px-0 text-xs"
                          onClick={() => navigate(`/client/course/${enrollment.courses.id}`)}
                        >
                          Continue
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <BookOpen className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Enroll in a course to start tracking your progress.
                  </p>
                  <Button onClick={() => navigate(`/client/courses`)}>Browse courses</Button>
                </CardContent>
              </Card>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <Card className="sticky top-28">
            <CardHeader>
              <CardTitle>Progress overview</CardTitle>
              <CardDescription>Track the activities you engaged with.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {totalCourses > 0 ? (
                <div className="space-y-3">
                  <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                    {progressSegments.length === 0 ? (
                      <div className="w-full bg-primary" />
                    ) : (
                      progressSegments.map((segment) => {
                        const width = Math.round((segment.value / totalCourses) * 100);
                        if (!width) return null;
                        return (
                          <div
                            key={segment.label}
                            className={`${segment.color}`}
                            style={{ width: `${width}%` }}
                            aria-label={`${segment.label} ${segment.value}`}
                          />
                        );
                      })
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Courses in progress</span>
                      <span>{coursesInProgress.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Courses completed</span>
                      <span>{coursesCompleted.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Lessons completed</span>
                      <span>{lessonsCompleted}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Enroll in courses to see your progress here.</p>
              )}

              <div className="border-t pt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>View progress</span>
                  <Button variant="link" className="p-0 h-auto" onClick={() => navigate(`/client/my-courses`)}>
                    Open
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <span>Browse catalog</span>
                  <Button variant="link" className="p-0 h-auto" onClick={() => navigate(`/client/courses`)}>
                    Explore
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </DashboardLayout>
  );
}
