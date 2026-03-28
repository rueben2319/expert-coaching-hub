export type EnrollmentTrendPoint = {
  month: string;
  enrollments: number;
};

type EnrollmentRecord = {
  enrolled_at: string;
};

export function buildEnrollmentTrend(
  enrollments: EnrollmentRecord[],
): EnrollmentTrendPoint[] {
  const enrollmentsByMonth = new Map<string, number>();
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    return date.toISOString().slice(0, 7);
  });

  last6Months.forEach((month) => enrollmentsByMonth.set(month, 0));

  enrollments.forEach((enrollment) => {
    const month = new Date(enrollment.enrolled_at).toISOString().slice(0, 7);
    if (enrollmentsByMonth.has(month)) {
      enrollmentsByMonth.set(month, (enrollmentsByMonth.get(month) || 0) + 1);
    }
  });

  return Array.from(enrollmentsByMonth.entries()).map(([month, count]) => ({
    month: new Date(`${month}-01`).toLocaleDateString("en-US", {
      month: "short",
    }),
    enrollments: count,
  }));
}
