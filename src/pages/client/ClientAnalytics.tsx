import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Award, Target, Clock, TrendingUp, Calendar, Flame, BarChart3 } from "lucide-react";
import { clientSidebarSections } from "@/config/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from "@/components/ui/chart";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";

export default function ClientAnalytics() {
  const { user } = useAuth();

  // Fetch user's enrollments with course data
  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["client-enrollments", user?.id],
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
        .eq("user_id", user!.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch user's lesson progress
  const { data: lessonProgress, isLoading: progressLoading } = useQuery({
    queryKey: ["client-lesson-progress", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_progress")
        .select(`
          *,
          lessons!inner(
            id,
            estimated_duration,
            course_modules!inner(
              courses!inner(id)
            )
          )
        `)
        .eq("user_id", user!.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Calculate analytics data
  const analyticsData = useMemo(() => {
    if (!enrollments || !lessonProgress) return null;

    const totalCourses = enrollments.length;
    const completedCourses = enrollments.filter(e => {
      const courseModules = e.courses?.course_modules || [];
      if (courseModules.length === 0) return false;

      const courseProgress = lessonProgress.filter(lp =>
        courseModules.some(cm =>
          cm.lessons?.some(lesson => lesson.id === lp.lesson_id)
        )
      );

      const studentProgresses = courseModules.map(module => {
        const completedLessons = module.lessons?.filter(lesson =>
          courseProgress.some(progress =>
            progress.lesson_id === lesson.id && progress.is_completed
          )
        ).length || 0;

        return module.lessons?.length > 0
          ? (completedLessons / module.lessons.length) * 100
          : 0;
      });

      const averageProgress = studentProgresses.length > 0
        ? studentProgresses.reduce((sum, progress) => sum + progress, 0) / studentProgresses.length
        : 0;

      return averageProgress >= 100;
    }).length;

    // Calculate current learning streak (consecutive days with activity)
    const progressByDate = new Map();
    lessonProgress.forEach(progress => {
      const date = new Date(progress.completed_at || progress.started_at).toDateString();
      progressByDate.set(date, (progressByDate.get(date) || 0) + 1);
    });

    let currentStreak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateStr = checkDate.toDateString();

      if (progressByDate.has(dateStr)) {
        currentStreak++;
      } else if (i > 0) {
        // Only break streak if we've already found some activity
        break;
      }
    }

    // Calculate total time spent learning
    const totalMinutes = lessonProgress.reduce((sum, progress) => {
      return sum + (progress.lessons?.estimated_duration || 0);
    }, 0);

    // Course progress details
    const courseProgressDetails = enrollments.map(enrollment => {
      const courseModules = enrollment.courses?.course_modules || [];
      const courseProgress = lessonProgress.filter(lp =>
        courseModules.some(cm =>
          cm.lessons?.some(lesson => lesson.id === lp.lesson_id)
        )
      );

      const studentProgresses = courseModules.map(module => {
        const completedLessons = module.lessons?.filter(lesson =>
          courseProgress.some(progress =>
            progress.lesson_id === lesson.id && progress.is_completed
          )
        ).length || 0;

        return module.lessons?.length > 0
          ? (completedLessons / module.lessons.length) * 100
          : 0;
      });

      const averageProgress = studentProgresses.length > 0
        ? studentProgresses.reduce((sum, progress) => sum + progress, 0) / studentProgresses.length
        : 0;

      return {
        id: enrollment.courses?.id,
        title: enrollment.courses?.title || "Unknown Course",
        progress: Math.round(averageProgress),
        enrolledAt: enrollment.enrolled_at,
        completedLessons: courseProgress.filter(p => p.is_completed).length,
        totalLessons: courseModules.reduce((sum, module) => sum + (module.lessons?.length || 0), 0)
      };
    });

    // Weekly activity breakdown (last 7 days)
    const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dateStr = date.toISOString().split('T')[0];
      
      const lessonsCompleted = lessonProgress.filter(p => {
        const progressDate = new Date(p.completed_at || p.started_at).toISOString().split('T')[0];
        return progressDate === dateStr && p.is_completed;
      }).length;

      return {
        day: date.toLocaleDateString("en-US", { weekday: "short" }),
        lessons: lessonsCompleted
      };
    });

    // Learning time trend (last 30 days)
    const timeByDay = new Map<string, number>();
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    last30Days.forEach(day => timeByDay.set(day, 0));

    lessonProgress.forEach(progress => {
      if (progress.is_completed && progress.completed_at) {
        const day = new Date(progress.completed_at).toISOString().split('T')[0];
        if (timeByDay.has(day)) {
          timeByDay.set(day, (timeByDay.get(day) || 0) + (progress.lessons?.estimated_duration || 0));
        }
      }
    });

    const learningTimeTrend = Array.from(timeByDay.entries())
      .slice(-7) // Show last 7 days
      .map(([date, minutes]) => ({
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        minutes
      }));

    return {
      totalCourses,
      completedCourses,
      currentStreak,
      totalMinutes,
      courseProgressDetails,
      weeklyActivity,
      learningTimeTrend
    };
  }, [enrollments, lessonProgress]);

  const isLoading = enrollmentsLoading || progressLoading;

  return (
    <DashboardLayout sidebarSections={clientSidebarSections} brandName="Experts Coaching Hub">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Learning Analytics</h1>
          <p className="text-muted-foreground">Track your learning progress and achievements</p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="bg-muted/30 rounded-lg p-6 animate-pulse">
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-6 bg-muted rounded w-1/2"></div>
                  <div className="h-3 bg-muted rounded w-1/4"></div>
                </div>
              </div>
            ))
          ) : analyticsData ? (
            [
              {
                title: "Total Courses",
                value: analyticsData.totalCourses.toString(),
                icon: BookOpen,
                description: "courses enrolled"
              },
              {
                title: "Courses Completed",
                value: analyticsData.completedCourses.toString(),
                icon: Award,
                description: "fully completed"
              },
              {
                title: "Learning Streak",
                value: `${analyticsData.currentStreak} days`,
                icon: Flame,
                description: "current streak"
              },
              {
                title: "Time Spent",
                value: `${Math.round(analyticsData.totalMinutes / 60)}h ${analyticsData.totalMinutes % 60}m`,
                icon: Clock,
                description: "learning time"
              }
            ].map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={index} className="bg-muted/30 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.description}</p>
                    </div>
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </div>
              );
            })
          ) : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Weekly Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Weekly Activity
              </CardTitle>
              <CardDescription>Lessons completed in the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[250px] flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : analyticsData ? (
                <ChartContainer
                  config={{
                    lessons: {
                      label: "Lessons",
                      color: "hsl(var(--primary))",
                    },
                  }}
                  className="h-[250px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.weeklyActivity}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="lessons" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : null}
            </CardContent>
          </Card>

          {/* Learning Time Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Study Time Trend
              </CardTitle>
              <CardDescription>Daily study time over the last week</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[250px] flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : analyticsData ? (
                <ChartContainer
                  config={{
                    minutes: {
                      label: "Minutes",
                      color: "hsl(var(--accent))",
                    },
                  }}
                  className="h-[250px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analyticsData.learningTimeTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line 
                        type="monotone" 
                        dataKey="minutes" 
                        stroke="hsl(var(--accent))" 
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--accent))", r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Course Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Course Progress
              </CardTitle>
              <CardDescription>Your progress in each enrolled course</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-2 bg-muted rounded"></div>
                  </div>
                ))
              ) : analyticsData?.courseProgressDetails.map(course => (
                <div key={course.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{course.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        {course.completedLessons} of {course.totalLessons} lessons completed
                      </p>
                    </div>
                    <Badge variant={course.progress >= 100 ? "default" : "secondary"}>
                      {course.progress}%
                    </Badge>
                  </div>
                  <Progress value={Math.max(course.progress, 5)} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Learning Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Learning Insights
              </CardTitle>
              <CardDescription>Your learning patterns and achievements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {analyticsData && (
                <>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Flame className="h-5 w-5 text-orange-500" />
                      <div>
                        <p className="font-medium">Current Streak</p>
                        <p className="text-sm text-muted-foreground">
                          {analyticsData.currentStreak} consecutive days of learning
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="font-medium">Study Time</p>
                        <p className="text-sm text-muted-foreground">
                          {Math.round(analyticsData.totalMinutes / 60)} hours spent learning
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Award className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-medium">Completion Rate</p>
                        <p className="text-sm text-muted-foreground">
                          {analyticsData.totalCourses > 0
                            ? Math.round((analyticsData.completedCourses / analyticsData.totalCourses) * 100)
                            : 0}% of courses completed
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="h-5 w-5 text-purple-500" />
                      <div>
                        <p className="font-medium">Average Progress</p>
                        <p className="text-sm text-muted-foreground">
                          {analyticsData.totalCourses > 0
                            ? Math.round(analyticsData.courseProgressDetails.reduce((sum, course) => sum + course.progress, 0) / analyticsData.totalCourses)
                            : 0}% across all courses
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Achievement Highlights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Achievement Highlights
            </CardTitle>
            <CardDescription>Your learning milestones and accomplishments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {analyticsData?.completedCourses > 0 && (
                <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                      <Award className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Course Champion</p>
                      <p className="text-sm text-muted-foreground">
                        Completed {analyticsData.completedCourses} course{analyticsData.completedCourses !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {analyticsData?.currentStreak >= 7 && (
                <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                      <Flame className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="font-medium">Consistency King</p>
                      <p className="text-sm text-muted-foreground">
                        {analyticsData.currentStreak} day learning streak
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {analyticsData?.totalMinutes >= 600 && ( // 10 hours
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium">Time Investor</p>
                      <p className="text-sm text-muted-foreground">
                        {Math.round(analyticsData.totalMinutes / 60)} hours of learning
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
