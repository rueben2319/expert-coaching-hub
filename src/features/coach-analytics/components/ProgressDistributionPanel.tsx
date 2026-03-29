import { Target } from "lucide-react";
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
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { ChartPanelSkeleton } from "./ChartPanelSkeleton";
import type { ProgressDistributionPoint } from "../lib/buildProgressDistribution";

type ProgressDistributionPanelProps = {
  isLoading: boolean;
  data: ProgressDistributionPoint[];
};

export default function ProgressDistributionPanel({
  isLoading,
  data,
}: ProgressDistributionPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Student Progress Distribution
        </CardTitle>
        <CardDescription>
          How students are progressing through courses
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChartPanelSkeleton />
        ) : (
          <ChartContainer
            config={{
              students: {
                label: "Students",
                color: "hsl(var(--primary))",
              },
            }}
            className="h-[300px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="students"
                  fill="hsl(var(--primary))"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
