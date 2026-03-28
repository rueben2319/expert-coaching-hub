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
import { Calendar } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { WeeklyActivityPoint } from "@/features/client-analytics/lib/types";
import { PanelErrorState } from "@/features/client-analytics/components/PanelErrorState";

type WeeklyActivityChartPanelProps = {
  isLoading: boolean;
  data: WeeklyActivityPoint[];
  error?: string | null;
};

export default function WeeklyActivityChartPanel({
  isLoading,
  data,
  error,
}: WeeklyActivityChartPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Weekly Activity
        </CardTitle>
        <CardDescription>Lessons completed in the last 7 days</CardDescription>
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
              lessons: {
                label: "Lessons",
                color: "hsl(var(--primary))",
              },
            }}
            className="h-[250px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="lessons" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
