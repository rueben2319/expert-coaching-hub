import { Banknote, Hourglass, TrendingUp } from "lucide-react";
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
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { ChartPanelSkeleton } from "./ChartPanelSkeleton";
import type { FinancialTrendPoint } from "../lib/buildFinancialTrend";

type FinancialData = {
  totalEarned: number;
  pendingWithdrawal: number;
  totalWithdrawn: number;
  earningsTrend: FinancialTrendPoint[];
};

type FinancialsPanelProps = {
  isLoading: boolean;
  financialData: FinancialData | null;
};

export default function FinancialsPanel({
  isLoading,
  financialData,
}: FinancialsPanelProps) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-muted/30 rounded-lg p-6 animate-pulse">
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-6 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))
          : financialData
            ? [
                {
                  title: "Total Earnings",
                  value: `CR ${financialData.totalEarned.toLocaleString()}`,
                  icon: Banknote,
                  color: "text-primary",
                },
                {
                  title: "Available for Withdrawal",
                  value: `CR ${financialData.pendingWithdrawal.toLocaleString()}`,
                  icon: Hourglass,
                  color: "text-amber-600",
                },
                {
                  title: "Total Withdrawn",
                  value: `CR ${financialData.totalWithdrawn.toLocaleString()}`,
                  icon: TrendingUp,
                  color: "text-green-600",
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Earnings Trend
          </CardTitle>
          <CardDescription>
            Your earnings from course enrollments over the last 6 months
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ChartPanelSkeleton />
          ) : financialData ? (
            <ChartContainer
              config={{
                earnings: {
                  label: "Earnings",
                  color: "hsl(var(--primary))",
                },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={financialData.earningsTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="earnings"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
