import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Clock } from "lucide-react";
import type { UseCoachDashboardDataResult } from "@/features/coach-dashboard/hooks/useCoachDashboardData";

type RecentCoursesListProps = {
  courses: UseCoachDashboardDataResult["recentCourses"];
  onOpenCourse: (courseId: string) => void;
};

export function RecentCoursesList({ courses, onOpenCourse }: RecentCoursesListProps) {
  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-2xl font-semibold">Recent Courses</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <Card
            key={course.id}
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => onOpenCourse(course.id)}
          >
            <CardHeader>
              <CardTitle className="text-lg">{course.title}</CardTitle>
              <CardDescription className="line-clamp-2">{course.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  {course.course_modules?.length || 0} modules
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {course.created_at ? new Date(course.created_at).toLocaleDateString() : "-"}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
