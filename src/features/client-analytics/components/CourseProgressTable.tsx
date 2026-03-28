import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";
import type { CourseProgressDetail } from "@/features/client-analytics/lib/types";
import { PanelErrorState } from "@/features/client-analytics/components/PanelErrorState";

type CourseProgressTableProps = {
  isLoading: boolean;
  courses: CourseProgressDetail[];
  error?: string | null;
};

export function CourseProgressTable({ isLoading, courses, error }: CourseProgressTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Course Progress
        </CardTitle>
        <CardDescription>Your progress in each enrolled course</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <PanelErrorState message={error} />
        ) : isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-2 bg-muted rounded" />
            </div>
          ))
        ) : courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No course progress data yet.</p>
        ) : (
          courses.map((course) => (
            <div key={course.id ?? course.title} className="space-y-2">
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
          ))
        )}
      </CardContent>
    </Card>
  );
}
