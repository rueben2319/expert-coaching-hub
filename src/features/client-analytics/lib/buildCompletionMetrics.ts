import type { CompletionMetrics, CourseProgressDetail } from "@/features/client-analytics/lib/types";

export function buildCompletionMetrics(
  courseProgressDetails: CourseProgressDetail[],
): CompletionMetrics {
  const totalCourses = courseProgressDetails.length;
  const completedCourses = courseProgressDetails.filter(
    (course) => course.progress >= 100,
  ).length;

  return {
    totalCourses,
    completedCourses,
    completionRate:
      totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0,
  };
}
