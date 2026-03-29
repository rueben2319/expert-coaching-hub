import { DashboardLayout } from "@/components/DashboardLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ClientHomeHero } from "@/components/client/home/ClientHomeHero";
import { CourseProgressGrid } from "@/components/client/home/CourseProgressGrid";
import { LearningProgressStrip } from "@/components/client/home/LearningProgressStrip";
import { RecommendationsPanel } from "@/components/client/home/RecommendationsPanel";
import { SectionErrorFallback } from "@/components/client/home/SectionErrorFallback";
import { UpNextCard } from "@/components/client/home/UpNextCard";
import { clientSidebarSections } from "@/config/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useClientHomeData } from "@/hooks/useClientHomeData";

export default function ClientDashboard() {
  const { user } = useAuth();

  const {
    enrichedEnrollments,
    upNext,
    overallProgress,
    progressSegments,
    totalCourses,
    lessonsCompleted,
    coursesInProgress,
    coursesCompleted,
    hasCourses,
    isLoading,
  } = useClientHomeData(user?.id);

  return (
    <DashboardLayout sidebarSections={clientSidebarSections} brandName="Experts Coaching Hub">
      <ClientHomeHero fullName={user?.user_metadata?.full_name} isLoading={isLoading} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <ErrorBoundary
            fallback={
              <SectionErrorFallback
                title="Unable to load next lesson"
                description="We couldn’t load your next learning step right now."
              />
            }
          >
            <UpNextCard upNextCourse={upNext} isLoading={isLoading} />
          </ErrorBoundary>

          <ErrorBoundary
            fallback={
              <SectionErrorFallback
                title="Unable to load course progress"
                description="Your course activity is temporarily unavailable."
              />
            }
          >
            <CourseProgressGrid
              enrollments={enrichedEnrollments}
              hasCourses={hasCourses}
              isLoading={isLoading}
            />
          </ErrorBoundary>
        </div>

        <aside className="space-y-6">
          <ErrorBoundary
            fallback={
              <SectionErrorFallback
                title="Recommendations unavailable"
                description="Course recommendations are unavailable at the moment."
              />
            }
          >
            <RecommendationsPanel isLoading={isLoading} />
          </ErrorBoundary>

          <ErrorBoundary
            fallback={
              <SectionErrorFallback
                title="Unable to load progress overview"
                description="Your learning summary couldn’t be loaded right now."
              />
            }
          >
            <LearningProgressStrip
              totalCourses={totalCourses}
              overallProgress={overallProgress}
              coursesInProgressCount={coursesInProgress.length}
              coursesCompletedCount={coursesCompleted.length}
              lessonsCompleted={lessonsCompleted}
              progressSegments={progressSegments}
              isLoading={isLoading}
            />
          </ErrorBoundary>
        </aside>
      </div>
    </DashboardLayout>
  );
}
