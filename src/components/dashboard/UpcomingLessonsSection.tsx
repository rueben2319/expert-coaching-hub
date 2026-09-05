import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, Play } from "lucide-react";
import type { UpcomingLesson } from "@/hooks/useUserDashboardData";

interface UpcomingLessonsSectionProps {
  upcomingLessons: UpcomingLesson[];
  isLoading: boolean;
  onContinueLesson: (lessonId: string, courseId: string) => void;
}

export function UpcomingLessonsSection({ upcomingLessons, isLoading, onContinueLesson }: UpcomingLessonsSectionProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Upcoming Lessons
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">Loading upcoming lessons...</div>
        </CardContent>
      </Card>
    );
  }

  if (!upcomingLessons || upcomingLessons.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Upcoming Lessons
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">Start a course to see your upcoming lessons</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Upcoming Lessons
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {upcomingLessons.map((lesson) => (
          <div
            key={lesson.id}
            className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-medium text-sm line-clamp-1 mb-1">{lesson.title}</h4>
                <p className="text-xs text-muted-foreground mb-2">
                  {lesson.courses.title} • {lesson.course_modules.title}
                </p>
                {lesson.estimated_duration && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{lesson.estimated_duration} min</span>
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="ml-2"
                onClick={() => onContinueLesson(lesson.id, lesson.courses.id)}
              >
                <Play className="h-4 w-4" />
              </Button>
            </div>
            {lesson.lesson_progress && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{lesson.lesson_progress.progress_percentage}%</span>
                </div>
                <Progress value={lesson.lesson_progress.progress_percentage} className="h-1" />
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
