import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Clock } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import type { StudyTimeTrendPoint } from "@/features/client-analytics/lib/types";
import { PanelErrorState } from "@/features/client-analytics/components/PanelErrorState";

type StudyTimeChartPanelProps = {
  isLoading: boolean;
  data: StudyTimeTrendPoint[];
  error?: string | null;
};

export default function StudyTimeChartPanel({ isLoading, data, error }: StudyTimeChartPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Study Time Trend
        </CardTitle>
        <CardDescription>Daily study time over the last week</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <PanelErrorState message={error} />
        ) : isLoading ? (
          <div className="h-[250px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <ChartContainer
            config={{
              minutes: {
                label: "Minutes",
                color: "hsl(var(--accent))",
              },
            }}
            className="h-[250px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="minutes"
                  stroke="hsl(var(--accent))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--accent))", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
