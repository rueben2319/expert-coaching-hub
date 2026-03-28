import { Award, Clock, TrendingUp, Users } from "lucide-react";

type OverviewMetrics = {
  totalStudents: number;
  activeStudents: number;
  completionRate: number;
  avgStudyTime: number;
};

type OverviewMetricsPanelProps = {
  isLoading: boolean;
  analyticsData: OverviewMetrics | null;
};

export function OverviewMetricsPanel({
  isLoading,
  analyticsData,
}: OverviewMetricsPanelProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {isLoading
        ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-muted/30 rounded-lg p-6 animate-pulse">
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-6 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))
        : analyticsData
          ? [
              {
                title: "Total Students",
                value: analyticsData.totalStudents.toString(),
                icon: Users,
                color: "text-primary",
              },
              {
                title: "Active Students",
                value: analyticsData.activeStudents.toString(),
                icon: TrendingUp,
                color: "text-green-600",
              },
              {
                title: "Completion Rate",
                value: `${Math.round(analyticsData.completionRate)}%`,
                icon: Award,
                color: "text-accent",
              },
              {
                title: "Avg Study Time",
                value: `${Math.round(analyticsData.avgStudyTime)}m`,
                icon: Clock,
                color: "text-blue-600",
              },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="bg-muted/30 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {stat.title}
                      </p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                    <div
                      className={`w-12 h-12 bg-muted rounded-lg flex items-center justify-center ${stat.color}`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                </div>
              );
            })
          : null}
    </div>
  );
}
