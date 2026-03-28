import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

interface ProgressSegment {
  label: string;
  value: number;
  color: string;
}

interface LearningProgressStripProps {
  totalCourses: number;
  overallProgress: number;
  coursesInProgressCount: number;
  coursesCompletedCount: number;
  lessonsCompleted: number;
  progressSegments: ProgressSegment[];
  isLoading?: boolean;
}

export function LearningProgressStrip({
  totalCourses,
  overallProgress,
  coursesInProgressCount,
  coursesCompletedCount,
  lessonsCompleted,
  progressSegments,
  isLoading = false,
}: LearningProgressStripProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card className="sticky top-28">
        <CardHeader>
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-56 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="sticky top-28">
      <CardHeader>
        <CardTitle>Progress overview</CardTitle>
        <CardDescription>Track the activities you engaged with.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {totalCourses > 0 ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Overall Progress</span>
                <span className="text-muted-foreground">{overallProgress}%</span>
              </div>
              <Progress value={Math.max(overallProgress, 5)} className="h-3" />
            </div>

            {progressSegments.length > 0 && (
              <div className="space-y-2">
                {progressSegments.map((segment) => (
                  <div key={segment.label} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${segment.color}`} />
                      {segment.label}
                    </span>
                    <span>{segment.value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">Total Courses</span>
                <span>{totalCourses}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Courses in progress</span>
                <span>{coursesInProgressCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Courses completed</span>
                <span>{coursesCompletedCount}</span>
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
  );
}
