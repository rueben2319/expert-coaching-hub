import { lazy, Suspense, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  BarChart3,
  Clock,
  Flame,
  TrendingUp,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { clientSidebarSections } from "@/config/navigation";
import { AnalyticsMetricCards } from "@/features/client-analytics/components/AnalyticsMetricCards";
import { ChartPanelSkeleton } from "@/features/client-analytics/components/ChartPanelSkeleton";
import { CourseProgressTable } from "@/features/client-analytics/components/CourseProgressTable";
import { PanelErrorState } from "@/features/client-analytics/components/PanelErrorState";
import { buildCompletionMetrics } from "@/features/client-analytics/lib/buildCompletionMetrics";
import { buildStreak } from "@/features/client-analytics/lib/buildStreak";
import { buildStudyTimeTrend } from "@/features/client-analytics/lib/buildStudyTimeTrend";
import { buildWeeklyActivity } from "@/features/client-analytics/lib/buildWeeklyActivity";
import type { CourseProgressDetail } from "@/features/client-analytics/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const WeeklyActivityChartPanel = lazy(
  () => import("@/features/client-analytics/components/WeeklyActivityChartPanel"),
);
const StudyTimeChartPanel = lazy(
  () => import("@/features/client-analytics/components/StudyTimeChartPanel"),
);

export default function ClientAnalytics() {
  const { user } = useAuth();

  const {
    data: enrollments,
    isLoading: enrollmentsLoading,
    error: enrollmentsError,
  } = useQuery({
    queryKey: ["client-enrollments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_enrollments")
        .select(
          `
          *,
          courses(
            *,
            course_modules(
              *,
              lessons(*)
            )
          )
        `,
        )
        .eq("user_id", user!.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const {
    data: lessonProgress,
    isLoading: progressLoading,
    error: progressError,
  } = useQuery({
    queryKey: ["client-lesson-progress", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_progress")
        .select(
          `
          *,
          lessons!inner(
            id,
            estimated_duration,
            course_modules!inner(
              courses!inner(id)
            )
          )
        `,
        )
        .eq("user_id", user!.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const analyticsData = useMemo(() => {
    if (!enrollments || !lessonProgress) return null;

    const courseProgressDetails: CourseProgressDetail[] = enrollments.map(
      (enrollment) => {
        const courseModules = enrollment.courses?.course_modules || [];
        const courseProgress = lessonProgress.filter((lp) =>
          courseModules.some((cm) =>
            cm.lessons?.some((lesson) => lesson.id === lp.lesson_id),
          ),
        );

        const studentProgresses = courseModules.map((module) => {
          const completedLessons =
            module.lessons?.filter((lesson) =>
              courseProgress.some(
                (progress) =>
                  progress.lesson_id === lesson.id && progress.is_completed,
              ),
            ).length || 0;

          return module.lessons?.length
            ? (completedLessons / module.lessons.length) * 100
            : 0;
        });

        const averageProgress =
          studentProgresses.length > 0
            ? studentProgresses.reduce((sum, value) => sum + value, 0) /
              studentProgresses.length
            : 0;

        return {
          id: enrollment.courses?.id ?? null,
          title: enrollment.courses?.title || "Unknown Course",
          progress: Math.round(averageProgress),
          completedLessons: courseProgress.filter((p) => p.is_completed).length,
          totalLessons: courseModules.reduce(
            (sum, module) => sum + (module.lessons?.length || 0),
            0,
          ),
        };
      },
    );

    const completionMetrics = buildCompletionMetrics(courseProgressDetails);
    const currentStreak = buildStreak(lessonProgress);
    const totalMinutes = lessonProgress.reduce(
      (sum, progress) => sum + (progress.lessons?.estimated_duration || 0),
      0,
    );

    return {
      ...completionMetrics,
      currentStreak,
      totalMinutes,
      courseProgressDetails,
      weeklyActivity: buildWeeklyActivity(lessonProgress),
      learningTimeTrend: buildStudyTimeTrend(lessonProgress),
    };
  }, [enrollments, lessonProgress]);

  const isLoading = enrollmentsLoading || progressLoading;
  const sharedError =
    enrollmentsError?.message || progressError?.message || "Unable to fetch analytics data.";

  return (
    <DashboardLayout sidebarSections={clientSidebarSections} brandName="Experts Coaching Hub">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Learning Analytics</h1>
          <p className="text-muted-foreground">
            Track your learning progress and achievements
          </p>
        </div>

        <AnalyticsMetricCards
          isLoading={isLoading}
          totalCourses={analyticsData?.totalCourses ?? 0}
          completedCourses={analyticsData?.completedCourses ?? 0}
          currentStreak={analyticsData?.currentStreak ?? 0}
          totalMinutes={analyticsData?.totalMinutes ?? 0}
          error={enrollmentsError ? sharedError : null}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <ErrorBoundary fallback={<PanelErrorState message="Weekly activity chart failed to render." />}>
            <Suspense fallback={<ChartPanelSkeleton />}>
              <WeeklyActivityChartPanel
                isLoading={isLoading}
                data={analyticsData?.weeklyActivity || []}
                error={progressError ? sharedError : null}
              />
            </Suspense>
          </ErrorBoundary>

          <ErrorBoundary fallback={<PanelErrorState message="Study time chart failed to render." />}>
            <Suspense fallback={<ChartPanelSkeleton />}>
              <StudyTimeChartPanel
                isLoading={isLoading}
                data={analyticsData?.learningTimeTrend || []}
                error={progressError ? sharedError : null}
              />
            </Suspense>
          </ErrorBoundary>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <CourseProgressTable
            isLoading={isLoading}
            courses={analyticsData?.courseProgressDetails || []}
            error={enrollmentsError || progressError ? sharedError : null}
          />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Learning Insights
              </CardTitle>
              <CardDescription>Your learning patterns and achievements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {enrollmentsError || progressError ? (
                <PanelErrorState message={sharedError} />
              ) : (
                analyticsData && (
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
                            {analyticsData.completionRate}% of courses completed
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
                              ? Math.round(
                                  analyticsData.courseProgressDetails.reduce(
                                    (sum, course) => sum + course.progress,
                                    0,
                                  ) / analyticsData.totalCourses,
                                )
                              : 0}
                            % across all courses
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
