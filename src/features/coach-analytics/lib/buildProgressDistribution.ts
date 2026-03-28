export type ProgressDistributionPoint = {
  range: string;
  students: number;
};

type EnrollmentRecord = {
  user_id: string;
  courses?: {
    course_modules?: Array<{
      lessons?: Array<{ id: string }>;
    }>;
  } | null;
};

type LessonProgressRecord = {
  user_id: string;
  lesson_id: string;
  is_completed: boolean;
};

export function buildProgressDistribution(
  enrollments: EnrollmentRecord[],
  lessonProgress: LessonProgressRecord[],
): ProgressDistributionPoint[] {
  const progressBuckets: Record<string, number> = {
    "0-25%": 0,
    "26-50%": 0,
    "51-75%": 0,
    "76-99%": 0,
    "100%": 0,
  };

  enrollments.forEach((enrollment) => {
    const courseLessons =
      enrollment.courses?.course_modules?.flatMap((m) => m.lessons || []) || [];
    const studentProgress = lessonProgress.filter(
      (lp) =>
        lp.user_id === enrollment.user_id &&
        courseLessons.some((lesson) => lesson.id === lp.lesson_id),
    );

    const completedLessons = studentProgress.filter(
      (p) => p.is_completed,
    ).length;
    const progress =
      courseLessons.length > 0
        ? (completedLessons / courseLessons.length) * 100
        : 0;

    if (progress === 100) progressBuckets["100%"]++;
    else if (progress >= 76) progressBuckets["76-99%"]++;
    else if (progress >= 51) progressBuckets["51-75%"]++;
    else if (progress >= 26) progressBuckets["26-50%"]++;
    else progressBuckets["0-25%"]++;
  });

  return Object.entries(progressBuckets).map(([range, count]) => ({
    range,
    students: count,
  }));
}
