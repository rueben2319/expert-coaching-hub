import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, DollarSign, Percent, Activity, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

interface WithdrawalAnalyticsProps {
  coachId?: string; // If provided, shows analytics for specific coach; otherwise shows all
}

type Period = "7d" | "30d" | "90d";

interface PeriodMetrics {
  successRate: number;
  avgProcessingTime: number;
  totalWithdrawn: number;
  totalRequests: number;
  completedCount: number;
  failedCount: number;
}

export function WithdrawalAnalytics({ coachId }: WithdrawalAnalyticsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("30d");

  const getPeriodDays = (period: Period): number => {
    switch (period) {
      case "7d": return 7;
      case "30d": return 30;
      case "90d": return 90;
    }
  };

  const calculatePeriodMetrics = (withdrawals: any[], startDate: Date, endDate: Date): PeriodMetrics => {
    const periodWithdrawals = withdrawals.filter(w => {
      const createdAt = new Date(w.created_at);
      return createdAt >= startDate && createdAt < endDate;
    });

    const statusCounts = {
      completed: periodWithdrawals.filter(w => w.status === "completed").length,
      failed: periodWithdrawals.filter(w => w.status === "failed").length,
      rejected: periodWithdrawals.filter(w => w.status === "rejected").length,
    };

    const totalProcessed = statusCounts.completed + statusCounts.failed + statusCounts.rejected;
    const successRate = totalProcessed > 0 ? (statusCounts.completed / totalProcessed) * 100 : 0;

    const completedWithdrawals = periodWithdrawals.filter(w => w.status === "completed" && w.processed_at);
    const avgProcessingTime = completedWithdrawals.length > 0
      ? completedWithdrawals.reduce((sum, w) => {
          const created = new Date(w.created_at).getTime();
          const processed = new Date(w.processed_at!).getTime();
          return sum + (processed - created);
        }, 0) / completedWithdrawals.length / 1000 / 60
      : 0;

    const totalWithdrawn = periodWithdrawals
      .filter(w => w.status === "completed")
      .reduce((sum, w) => sum + (w.amount || 0), 0);

    return {
      successRate,
      avgProcessingTime,
      totalWithdrawn,
      totalRequests: periodWithdrawals.length,
      completedCount: statusCounts.completed,
      failedCount: statusCounts.failed,
    };
  };

  const { data: analytics, isLoading } = useQuery({
    queryKey: ["withdrawal-analytics", coachId, selectedPeriod],
    queryFn: async () => {
      // Fetch withdrawal requests
      let query = supabase
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (coachId) {
        query = query.eq("coach_id", coachId);
      }

      const { data: withdrawals, error } = await query;
      if (error) throw error;

      // Calculate metrics
      const now = new Date();
      const periodDays = getPeriodDays(selectedPeriod);
      
      // Current period
      const currentPeriodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
      const currentPeriodEnd = now;
      
      // Previous period (same duration, immediately before current period)
      const previousPeriodStart = new Date(currentPeriodStart.getTime() - periodDays * 24 * 60 * 60 * 1000);
      const previousPeriodEnd = currentPeriodStart;

      const allWithdrawals = withdrawals || [];
      
      // Calculate metrics for both periods
      const currentMetrics = calculatePeriodMetrics(allWithdrawals, currentPeriodStart, currentPeriodEnd);
      const previousMetrics = calculatePeriodMetrics(allWithdrawals, previousPeriodStart, previousPeriodEnd);
      
      // Calculate percentage changes with defensive checks
      const calculateChange = (current: number, previous: number): number => {
        // If previous is 0 and current is 0, no change
        if (previous === 0 && current === 0) return 0;
        // If previous is 0 but current > 0, treat as 100% increase
        if (previous === 0) return 100;
        // Normal calculation
        return ((current - previous) / previous) * 100;
      };

      const successRateChange = calculateChange(currentMetrics.successRate, previousMetrics.successRate);
      const processingTimeChange = calculateChange(currentMetrics.avgProcessingTime, previousMetrics.avgProcessingTime);
      const withdrawnChange = calculateChange(currentMetrics.totalWithdrawn, previousMetrics.totalWithdrawn);
      const requestsChange = calculateChange(currentMetrics.totalRequests, previousMetrics.totalRequests);

      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30Days = allWithdrawals.filter(w => new Date(w.created_at) >= thirtyDaysAgo);
      const last7Days = allWithdrawals.filter(w => new Date(w.created_at) >= sevenDaysAgo);

      // Status breakdown
      const statusCounts = {
        completed: allWithdrawals.filter(w => w.status === "completed").length,
        failed: allWithdrawals.filter(w => w.status === "failed").length,
        processing: allWithdrawals.filter(w => w.status === "processing").length,
        pending: allWithdrawals.filter(w => w.status === "pending").length,
        rejected: allWithdrawals.filter(w => w.status === "rejected").length,
      };

      // Success rate
      const totalProcessed = statusCounts.completed + statusCounts.failed + statusCounts.rejected;
      const successRate = totalProcessed > 0 ? (statusCounts.completed / totalProcessed) * 100 : 0;

      // Average processing time (for completed withdrawals)
      const completedWithdrawals = allWithdrawals.filter(w => w.status === "completed" && w.processed_at);
      const avgProcessingTime = completedWithdrawals.length > 0
        ? completedWithdrawals.reduce((sum, w) => {
            const created = new Date(w.created_at).getTime();
            const processed = new Date(w.processed_at!).getTime();
            return sum + (processed - created);
          }, 0) / completedWithdrawals.length / 1000 / 60 // Convert to minutes
        : 0;

      // Total amounts
      const totalWithdrawn = allWithdrawals
        .filter(w => w.status === "completed")
        .reduce((sum, w) => sum + (w.amount || 0), 0);

      const totalCreditsWithdrawn = allWithdrawals
        .filter(w => w.status === "completed")
        .reduce((sum, w) => sum + (w.credits_amount || 0), 0);

      // Trend data (last 30 days)
      const trendData: Record<string, { date: string; completed: number; failed: number; amount: number }> = {};
      
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateKey = date.toISOString().split('T')[0];
        trendData[dateKey] = {
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          completed: 0,
          failed: 0,
          amount: 0,
        };
      }

      last30Days.forEach(w => {
        const dateKey = new Date(w.created_at).toISOString().split('T')[0];
        if (trendData[dateKey]) {
          if (w.status === "completed") {
            trendData[dateKey].completed += 1;
            trendData[dateKey].amount += w.amount || 0;
          } else if (w.status === "failed") {
            trendData[dateKey].failed += 1;
          }
        }
      });

      const trendArray = Object.values(trendData);

      // Status pie chart data
      const statusPieData = [
        { name: "Completed", value: statusCounts.completed, color: "#22c55e" },
        { name: "Failed", value: statusCounts.failed, color: "#ef4444" },
        { name: "Processing", value: statusCounts.processing, color: "#3b82f6" },
        { name: "Pending", value: statusCounts.pending, color: "#f59e0b" },
        { name: "Rejected", value: statusCounts.rejected, color: "#dc2626" },
      ].filter(item => item.value > 0);

      // Failure reasons analysis
      const failureReasons: Record<string, number> = {};
      allWithdrawals
        .filter(w => w.status === "failed" && w.rejection_reason)
        .forEach(w => {
          const reason = w.rejection_reason!.substring(0, 50); // Truncate long reasons
          failureReasons[reason] = (failureReasons[reason] || 0) + 1;
        });

      const topFailureReasons = Object.entries(failureReasons)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([reason, count]) => ({ reason, count }));

      return {
        statusCounts,
        successRate: currentMetrics.successRate,
        avgProcessingTime: currentMetrics.avgProcessingTime,
        totalWithdrawn: currentMetrics.totalWithdrawn,
        totalCreditsWithdrawn,
        trendData: trendArray,
        statusPieData,
        topFailureReasons,
        totalWithdrawals: allWithdrawals.length,
        last30DaysCount: last30Days.length,
        last7DaysCount: last7Days.length,
        currentRequests: currentMetrics.totalRequests,
        // Comparison metrics
        comparison: {
          successRateChange,
          processingTimeChange,
          withdrawnChange,
          requestsChange,
          previousMetrics,
        },
      };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  const formatMWK = (amount: number) => {
    return new Intl.NumberFormat('en-MW', {
      style: 'currency',
      currency: 'MWK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <ArrowUp className="h-4 w-4 text-green-600" />;
    if (change < 0) return <ArrowDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return "text-green-600";
    if (change < 0) return "text-red-600";
    return "text-gray-600";
  };

  return (
    <div className="space-y-6">
      {/* Period Selector and Comparison */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Analytics</h3>
          <p className="text-sm text-muted-foreground">
            Comparing current period with previous period
          </p>
        </div>
        <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as Period)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics with Comparison */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">{analytics.successRate.toFixed(1)}%</div>
              <div className={`flex items-center gap-1 ${getChangeColor(analytics.comparison.successRateChange)}`}>
                {getChangeIcon(analytics.comparison.successRateChange)}
                <span className="text-xs font-medium">
                  {Math.abs(analytics.comparison.successRateChange).toFixed(1)}%
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {analytics.statusCounts.completed} of {analytics.statusCounts.completed + analytics.statusCounts.failed + analytics.statusCounts.rejected} processed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Processing Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">
                {analytics.avgProcessingTime < 1 
                  ? `${(analytics.avgProcessingTime * 60).toFixed(0)}s`
                  : `${analytics.avgProcessingTime.toFixed(1)}m`}
              </div>
              <div className={`flex items-center gap-1 ${getChangeColor(-analytics.comparison.processingTimeChange)}`}>
                {getChangeIcon(-analytics.comparison.processingTimeChange)}
                <span className="text-xs font-medium">
                  {Math.abs(analytics.comparison.processingTimeChange).toFixed(1)}%
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Based on {analytics.statusCounts.completed} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Withdrawn</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">{formatMWK(analytics.totalWithdrawn)}</div>
              <div className={`flex items-center gap-1 ${getChangeColor(analytics.comparison.withdrawnChange)}`}>
                {getChangeIcon(analytics.comparison.withdrawnChange)}
                <span className="text-xs font-medium">
                  {Math.abs(analytics.comparison.withdrawnChange).toFixed(1)}%
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {analytics.totalCreditsWithdrawn.toLocaleString()} credits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">{analytics.currentRequests}</div>
              <div className={`flex items-center gap-1 ${getChangeColor(analytics.comparison.requestsChange)}`}>
                {getChangeIcon(analytics.comparison.requestsChange)}
                <span className="text-xs font-medium">
                  {Math.abs(analytics.comparison.requestsChange).toFixed(1)}%
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {analytics.last7DaysCount} in last 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.statusCounts.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.statusCounts.failed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.statusCounts.processing}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.statusCounts.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-700" />
              Rejected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.statusCounts.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>30-Day Withdrawal Trend</CardTitle>
            <CardDescription>Completed vs Failed withdrawals over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={analytics.trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="completed" stackId="1" stroke="#22c55e" fill="#22c55e" name="Completed" />
                <Area type="monotone" dataKey="failed" stackId="1" stroke="#ef4444" fill="#ef4444" name="Failed" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
            <CardDescription>Breakdown of all withdrawal statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.statusPieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {analytics.statusPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Amount Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Withdrawal Amount Trend (MWK)</CardTitle>
          <CardDescription>Daily withdrawal amounts over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip formatter={(value) => formatMWK(Number(value))} />
              <Legend />
              <Bar dataKey="amount" fill="#3b82f6" name="Amount (MWK)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Failure Reasons */}
      {analytics.topFailureReasons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Failure Reasons</CardTitle>
            <CardDescription>Most common reasons for withdrawal failures</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topFailureReasons.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.reason}</p>
                  </div>
                  <Badge variant="secondary">{item.count} occurrences</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
