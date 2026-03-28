import { lazy, Suspense, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { coachSidebarSections } from "@/config/navigation";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp } from "lucide-react";
import { WithdrawalAnalytics } from "@/components/WithdrawalAnalytics";
import { OverviewMetricsPanel } from "@/features/coach-analytics/components/OverviewMetricsPanel";
import { WithdrawalsPanel } from "@/features/coach-analytics/components/WithdrawalsPanel";
import { ChartPanelSkeleton } from "@/features/coach-analytics/components/ChartPanelSkeleton";
import { AnalyticsSectionErrorBoundary } from "@/features/coach-analytics/components/AnalyticsSectionErrorBoundary";
import { buildEnrollmentTrend } from "@/features/coach-analytics/lib/buildEnrollmentTrend";
import { buildProgressDistribution } from "@/features/coach-analytics/lib/buildProgressDistribution";
import { buildFinancialTrend } from "@/features/coach-analytics/lib/buildFinancialTrend";

const EnrollmentTrendPanel = lazy(
  () => import("@/features/coach-analytics/components/EnrollmentTrendPanel"),
);
const ProgressDistributionPanel = lazy(
  () =>
    import("@/features/coach-analytics/components/ProgressDistributionPanel"),
);
const FinancialsPanel = lazy(
  () => import("@/features/coach-analytics/components/FinancialsPanel"),
);

export default function CoachAnalytics() {
  const { user } = useAuth();
  const { wallet, transactions, withdrawalRequests } = useCredits();

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ["coach-courses-analytics", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(
          `
          *,
          course_modules(
            *,
            lessons(*)
          )
        `,
        )
        .eq("coach_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["coach-enrollments-analytics", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_enrollments")
        .select(
          `
          *,
          courses!inner(
            id,
            title,
            coach_id,
            course_modules(
              id,
              lessons(id)
            )
          ),
          profiles(full_name, email)
        `,
        )
        .eq("courses.coach_id", user!.id)
        .order("enrolled_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: lessonProgress, isLoading: progressLoading } = useQuery({
    queryKey: ["coach-lesson-progress", user?.id],
    queryFn: async () => {
      if (!enrollments) return [];
      const userIds = enrollments.map((e) => e.user_id);
      if (userIds.length === 0) return [];

      const { data, error } = await supabase
        .from("lesson_progress")
        .select(
          `
          *,
          lessons!inner(
            id,
            estimated_duration,
            module_id,
            course_modules!inner(
              course_id,
              courses!inner(coach_id)
            )
          )
        `,
        )
        .in("user_id", userIds)
        .eq("lessons.course_modules.courses.coach_id", user!.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!enrollments,
  });

  const financialData = useMemo(() => {
    if (!wallet || !transactions || !withdrawalRequests) return null;

    return {
      totalEarned: wallet.total_earned || 0,
      pendingWithdrawal: wallet.balance || 0,
      totalWithdrawn: (wallet.total_earned || 0) - (wallet.balance || 0),
      earningsTrend: buildFinancialTrend(transactions),
    };
  }, [wallet, transactions, withdrawalRequests]);

  const analyticsData = useMemo(() => {
    if (!courses || !enrollments || !lessonProgress) return null;

    const enrollmentTrend = buildEnrollmentTrend(enrollments);

    const coursePerformance = courses.map((course) => {
      const courseEnrollments = enrollments.filter(
        (e) => e.courses?.id === course.id,
      );
      const courseLessons =
        course.course_modules?.flatMap((m) => m.lessons || []) || [];

      const completedStudents = courseEnrollments.filter((enrollment) => {
        const studentProgress = lessonProgress.filter(
          (lp) =>
            lp.user_id === enrollment.user_id &&
            courseLessons.some((lesson) => lesson.id === lp.lesson_id),
        );

        const completedLessons = studentProgress.filter(
          (p) => p.is_completed,
        ).length;
        return (
          courseLessons.length > 0 && completedLessons === courseLessons.length
        );
      }).length;

      const avgProgress =
        courseEnrollments.length > 0
          ? courseEnrollments.reduce((sum, enrollment) => {
              const studentProgress = lessonProgress.filter(
                (lp) =>
                  lp.user_id === enrollment.user_id &&
                  courseLessons.some((lesson) => lesson.id === lp.lesson_id),
              );
              const completedLessons = studentProgress.filter(
                (p) => p.is_completed,
              ).length;
              return (
                sum +
                (courseLessons.length > 0
                  ? (completedLessons / courseLessons.length) * 100
                  : 0)
              );
            }, 0) / courseEnrollments.length
          : 0;

      return {
        name:
          course.title.length > 20
            ? `${course.title.substring(0, 20)}...`
            : course.title,
        students: courseEnrollments.length,
        completed: completedStudents,
        avgProgress: Math.round(avgProgress),
      };
    });

    const progressDistribution = buildProgressDistribution(
      enrollments,
      lessonProgress,
    );

    const totalStudents = enrollments.length;
    const activeStudents = new Set(lessonProgress.map((p) => p.user_id)).size;
    const completedBucket =
      progressDistribution.find((p) => p.range === "100%")?.students || 0;
    const completionRate =
      enrollments.length > 0 ? (completedBucket / enrollments.length) * 100 : 0;
    const avgStudyTime =
      lessonProgress.reduce(
        (sum, p) => sum + (p.lessons?.estimated_duration || 0),
        0,
      ) / (totalStudents || 1);

    return {
      enrollmentTrend,
      coursePerformance,
      progressDistribution,
      totalStudents,
      activeStudents,
      completionRate,
      avgStudyTime,
    };
  }, [courses, enrollments, lessonProgress]);

  const isLoading = coursesLoading || enrollmentsLoading || progressLoading;

  return (
    <DashboardLayout sidebarSections={coachSidebarSections}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Track your coaching performance and student progress
          </p>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="financials">Financials</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-6">
            <AnalyticsSectionErrorBoundary sectionName="Overview">
              <OverviewMetricsPanel
                isLoading={isLoading}
                analyticsData={analyticsData}
              />

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Course Performance Comparison
                  </CardTitle>
                  <CardDescription>
                    Compare enrollment and completion rates across your courses
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="animate-pulse space-y-2">
                          <div className="h-4 bg-muted rounded w-3/4" />
                          <div className="h-2 bg-muted rounded" />
                        </div>
                      ))}
                    </div>
                  ) : analyticsData?.coursePerformance.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No course data available yet
                    </p>
                  ) : analyticsData ? (
                    <div className="space-y-4">
                      {analyticsData.coursePerformance.map((course, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">
                                {course.name}
                              </h4>
                              <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                                <span>{course.students} enrolled</span>
                                <span>{course.completed} completed</span>
                              </div>
                            </div>
                            <Badge
                              variant={
                                course.avgProgress >= 75
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {course.avgProgress}% avg
                            </Badge>
                          </div>
                          <Progress
                            value={Math.max(course.avgProgress, 5)}
                            className="h-2"
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Key Insights
                  </CardTitle>
                  <CardDescription>
                    Actionable recommendations based on your analytics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {analyticsData && (
                    <div className="space-y-4">
                      {analyticsData.completionRate < 50 && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <p className="font-medium text-sm">
                            Low completion rate detected
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Only {Math.round(analyticsData.completionRate)}% of
                            students complete their courses. Consider adding
                            more engaging content or breaking lessons into
                            smaller chunks.
                          </p>
                        </div>
                      )}

                      {analyticsData.activeStudents <
                        analyticsData.totalStudents * 0.5 &&
                        analyticsData.totalStudents > 0 && (
                          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <p className="font-medium text-sm">
                              Low student engagement
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {Math.round(
                                (analyticsData.activeStudents /
                                  analyticsData.totalStudents) *
                                  100,
                              )}
                              % of your students are actively learning. Try
                              sending reminders or creating discussion forums to
                              boost engagement.
                            </p>
                          </div>
                        )}

                      {analyticsData.completionRate >= 75 && (
                        <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                          <p className="font-medium text-sm">
                            Excellent completion rate! 🎉
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {Math.round(analyticsData.completionRate)}% of
                            students complete their courses. Your content is
                            highly engaging and effective.
                          </p>
                        </div>
                      )}

                      {analyticsData.coursePerformance.length === 0 && (
                        <div className="p-4 bg-muted/50 rounded-lg text-center">
                          <p className="text-sm text-muted-foreground">
                            Create courses and enroll students to see insights
                            here
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </AnalyticsSectionErrorBoundary>
          </TabsContent>

          <TabsContent value="students" className="mt-6 space-y-6">
            <AnalyticsSectionErrorBoundary sectionName="Students">
              <div className="grid gap-6 lg:grid-cols-2">
                <ErrorBoundary fallback={<ChartPanelSkeleton />}>
                  <Suspense fallback={<ChartPanelSkeleton />}>
                    <EnrollmentTrendPanel
                      isLoading={isLoading}
                      data={analyticsData?.enrollmentTrend || []}
                    />
                  </Suspense>
                </ErrorBoundary>

                <ErrorBoundary fallback={<ChartPanelSkeleton />}>
                  <Suspense fallback={<ChartPanelSkeleton />}>
                    <ProgressDistributionPanel
                      isLoading={isLoading}
                      data={analyticsData?.progressDistribution || []}
                    />
                  </Suspense>
                </ErrorBoundary>
              </div>
            </AnalyticsSectionErrorBoundary>
          </TabsContent>

          <TabsContent value="financials" className="mt-6 space-y-6">
            <AnalyticsSectionErrorBoundary sectionName="Financials">
              <ErrorBoundary fallback={<ChartPanelSkeleton />}>
                <Suspense fallback={<ChartPanelSkeleton />}>
                  <FinancialsPanel
                    isLoading={isLoading}
                    financialData={financialData}
                  />
                </Suspense>
              </ErrorBoundary>
              <WithdrawalsPanel withdrawalRequests={withdrawalRequests} />
            </AnalyticsSectionErrorBoundary>
          </TabsContent>

          <TabsContent value="withdrawals" className="space-y-6">
            <AnalyticsSectionErrorBoundary sectionName="Withdrawals">
              <div>
                <h2 className="text-2xl font-bold mb-2">
                  Withdrawal Analytics
                </h2>
                <p className="text-muted-foreground">
                  Track your withdrawal performance, success rates, and trends
                </p>
              </div>
              <WithdrawalAnalytics coachId={user?.id} />
            </AnalyticsSectionErrorBoundary>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
