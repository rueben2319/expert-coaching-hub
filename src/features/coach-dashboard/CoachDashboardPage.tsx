import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EmptyCoursesState } from "@/features/coach-dashboard/components/EmptyCoursesState";
import { KpiGrid } from "@/features/coach-dashboard/components/KpiGrid";
import { KpiGridSkeleton } from "@/features/coach-dashboard/components/KpiGridSkeleton";
import { RecentCoursesList } from "@/features/coach-dashboard/components/RecentCoursesList";
import { DashboardSectionError } from "@/features/coach-dashboard/components/DashboardSectionError";
import { useCoachDashboardData } from "@/features/coach-dashboard/hooks/useCoachDashboardData";

export function CoachDashboardPage() {
  const navigate = useNavigate();
  const {
    metrics,
    recentCourses,
    isKpiLoading,
    isCoursesLoading,
    coursesError,
    enrollmentsError,
    hasCourses,
  } = useCoachDashboardData();

  const hasKpiError = Boolean(coursesError || enrollmentsError);

  return (
    <>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Coach Dashboard
          </h1>
          <p className="text-muted-foreground">Create and manage your courses</p>
        </div>
        <Button
          className="bg-gradient-to-r from-primary to-accent hover:opacity-90 w-full sm:w-auto"
          onClick={() => navigate("/coach/courses/create")}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Course
        </Button>
      </div>

      <section aria-label="Dashboard KPIs">
        {isKpiLoading ? (
          <KpiGridSkeleton />
        ) : hasKpiError ? (
          <DashboardSectionError
            title="Unable to load dashboard metrics"
            message="Please refresh the page. If the issue persists, try again in a few minutes."
          />
        ) : (
          <KpiGrid
            metrics={metrics}
            onOpenFinancialAnalytics={() => navigate("/coach/analytics", { state: { defaultTab: "financial-analytics" } })}
            onOpenWithdrawals={() => navigate("/coach/withdrawals")}
            onOpenCourses={() => navigate("/coach/courses")}
            onOpenStudents={() => navigate("/coach/students")}
            onOpenAnalytics={() => navigate("/coach/analytics")}
          />
        )}
      </section>

      <section aria-label="Recent coach courses">
        {!isCoursesLoading && !coursesError && hasCourses && (
          <RecentCoursesList
            courses={recentCourses}
            onOpenCourse={(courseId) => navigate(`/coach/courses/${courseId}/edit`)}
          />
        )}

        {!isCoursesLoading && !coursesError && !hasCourses && (
          <EmptyCoursesState onCreateCourse={() => navigate("/coach/courses/create")} />
        )}

        {!isCoursesLoading && coursesError && (
          <div className="mt-8">
            <DashboardSectionError
              title="Unable to load recent courses"
              message="We could not fetch your courses right now. Please try again shortly."
            />
          </div>
        )}
      </section>
    </>
  );
}
