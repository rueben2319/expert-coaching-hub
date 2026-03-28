import { useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { EnrichedEnrollment } from "@/hooks/useClientHomeData";

interface CourseProgressGridProps {
  enrollments: EnrichedEnrollment[];
  hasCourses: boolean;
  isLoading?: boolean;
}

function CourseGridSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading courses"
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      {[1, 2, 3].map((skeleton) => (
        <Card key={skeleton} className="animate-pulse" aria-hidden="true">
          <CardContent className="h-40" />
        </Card>
      ))}
      <span className="sr-only">Loading courses, please wait...</span>
    </div>
  );
}

export function CourseProgressGrid({ enrollments, hasCourses, isLoading = false }: CourseProgressGridProps) {
  const navigate = useNavigate();

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Stay on track</h2>
        <Button variant="link" className="p-0 text-sm" onClick={() => navigate(`/client/my-courses`)}>
          View all activities
        </Button>
      </div>

      {isLoading ? (
        <CourseGridSkeleton />
      ) : hasCourses ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {enrollments.map((enrollment) => (
            <Card key={enrollment.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-base line-clamp-2">{enrollment.courses.title}</CardTitle>
                <CardDescription className="line-clamp-2 min-h-[40px]">
                  {enrollment.courses.description || "Keep making progress on this course."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={Math.max(enrollment.calculatedProgress, 5)} />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{Math.round(enrollment.calculatedProgress)}% complete</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-[44px] min-w-[44px] px-3 py-2 text-xs md:h-auto md:px-0"
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
        <Card className="text-center py-12" role="status" aria-live="polite">
          <CardContent>
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground mb-4" aria-hidden="true" />
            <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Enroll in a course to start tracking your progress.
            </p>
            <Button onClick={() => navigate(`/client/courses`)}>Browse courses</Button>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
