import type { WeeklyActivityPoint } from "@/features/client-analytics/lib/types";

export function buildWeeklyActivity(
  progressItems: Array<{
    is_completed: boolean | null;
    started_at: string | null;
    completed_at: string | null;
  }>,
): WeeklyActivityPoint[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dateStr = date.toISOString().split("T")[0];

    const lessonsCompleted = progressItems.filter((item) => {
      const sourceDate = item.completed_at || item.started_at;
      if (!sourceDate || !item.is_completed) return false;

      return new Date(sourceDate).toISOString().split("T")[0] === dateStr;
    }).length;

    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      lessons: lessonsCompleted,
    };
  });
}
