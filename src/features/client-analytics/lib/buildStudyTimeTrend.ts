import type { StudyTimeTrendPoint } from "@/features/client-analytics/lib/types";

export function buildStudyTimeTrend(
  progressItems: Array<{
    is_completed: boolean | null;
    completed_at: string | null;
    lessons?: { estimated_duration: number | null } | null;
  }>,
): StudyTimeTrendPoint[] {
  const timeByDay = new Map<string, number>();
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return date.toISOString().split("T")[0];
  });

  last30Days.forEach((day) => timeByDay.set(day, 0));

  progressItems.forEach((progress) => {
    if (!progress.is_completed || !progress.completed_at) return;

    const day = new Date(progress.completed_at).toISOString().split("T")[0];
    if (!timeByDay.has(day)) return;

    timeByDay.set(
      day,
      (timeByDay.get(day) || 0) + (progress.lessons?.estimated_duration || 0),
    );
  });

  return Array.from(timeByDay.entries())
    .slice(-7)
    .map(([date, minutes]) => ({
      date: new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      minutes,
    }));
}
