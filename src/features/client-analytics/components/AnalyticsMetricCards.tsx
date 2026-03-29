import { BookOpen, Award, Flame, Clock } from "lucide-react";

type AnalyticsMetricCardsProps = {
  isLoading: boolean;
  totalCourses: number;
  completedCourses: number;
  currentStreak: number;
  totalMinutes: number;
  error?: string | null;
};

export function AnalyticsMetricCards({
  isLoading,
  totalCourses,
  completedCourses,
  currentStreak,
  totalMinutes,
  error,
}: AnalyticsMetricCardsProps) {
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Could not load overview metrics. {error}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {isLoading
        ? Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="bg-muted/30 rounded-lg p-6 animate-pulse">
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-6 bg-muted rounded w-1/2" />
                <div className="h-3 bg-muted rounded w-1/4" />
              </div>
            </div>
          ))
        : [
            {
              title: "Total Courses",
              value: totalCourses.toString(),
              icon: BookOpen,
              description: "courses enrolled",
            },
            {
              title: "Courses Completed",
              value: completedCourses.toString(),
              icon: Award,
              description: "fully completed",
            },
            {
              title: "Learning Streak",
              value: `${currentStreak} days`,
              icon: Flame,
              description: "current streak",
            },
            {
              title: "Time Spent",
              value: `${Math.round(totalMinutes / 60)}h ${totalMinutes % 60}m`,
              icon: Clock,
              description: "learning time",
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.title} className="bg-muted/30 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.description}</p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </div>
            );
          })}
    </div>
  );
}
