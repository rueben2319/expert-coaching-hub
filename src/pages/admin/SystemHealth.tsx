import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminSidebarSections } from "@/config/navigation";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database, 
  RefreshCw, 
  Server, 
  Zap,
  XCircle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ShieldAlert,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

interface EdgeFunctionLog {
  function_id: string;
  function_name?: string;
  event_type: string;
  event_message: string;
  level: string;
  timestamp: number;
  execution_time_ms?: number;
  status_code?: number;
}

interface DatabaseLog {
  identifier: string;
  timestamp: string;
  event_message: string;
  error_severity: string;
}

interface AuthLog {
  id: string;
  timestamp: string;
  event_message: string;
  level: string;
  status: number;
  path: string;
  msg: string;
  error: string | null;
}

interface TimeSeriesData {
  time: string;
  value: number;
  errors?: number;
}

interface StatusDistribution {
  name: string;
  value: number;
  color: string;
}

type ConfidenceLevel = "high" | "medium" | "low";
type DataSourceMode = "real_telemetry" | "fallback";

interface HealthDataSourceStatus {
  mode: DataSourceMode;
  source: string;
  details: string;
  updatedAt: string;
}

interface HealthMetrics {
  dataSourceStatus: HealthDataSourceStatus;
  edgeFunctions: {
    confidence: ConfidenceLevel;
    totalCalls: number;
    successRate: number;
    avgResponseTime: number;
    errors: number;
    recentLogs: EdgeFunctionLog[];
    responseTimeTrend: TimeSeriesData[];
    requestsTrend: TimeSeriesData[];
    statusDistribution: StatusDistribution[];
  };
  database: {
    confidence: ConfidenceLevel;
    totalQueries: number;
    errorCount: number;
    warningCount: number;
    recentLogs: DatabaseLog[];
    severityDistribution: StatusDistribution[];
  };
  auth: {
    confidence: ConfidenceLevel;
    totalRequests: number;
    successRate: number;
    failedAttempts: number;
    recentLogs: AuthLog[];
    requestsTrend: TimeSeriesData[];
    statusDistribution: StatusDistribution[];
  };
}

type EndpointHealthMetrics = {
  updatedAt?: string;
  edgeFunctions?: Partial<HealthMetrics["edgeFunctions"]>;
  database?: Partial<HealthMetrics["database"]>;
  auth?: Partial<HealthMetrics["auth"]>;
};

export default function SystemHealth() {
  const [timeRange, setTimeRange] = useState("1h");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: healthData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["system-health", timeRange],
    queryFn: async (): Promise<HealthMetrics> => {
      const nowIso = new Date().toISOString();

      // Prefer scheduled ETL table first for edge latency/error rates, auth outcomes,
      // and DB severity counts.
      const { data: etlRollup, error: etlError } = await supabase
        .from("system_health_rollups")
        .select("*")
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!etlError && etlRollup) {
        const edgeTotal = Number((etlRollup as Record<string, unknown>).edge_total_calls ?? 0);
        const edgeErrors = Number((etlRollup as Record<string, unknown>).edge_error_calls ?? 0);
        const authTotal = Number((etlRollup as Record<string, unknown>).auth_total_requests ?? 0);
        const authFailed = Number((etlRollup as Record<string, unknown>).auth_failed_requests ?? 0);
        const dbWarnings = Number((etlRollup as Record<string, unknown>).db_warning_count ?? 0);
        const dbErrors = Number((etlRollup as Record<string, unknown>).db_error_count ?? 0);
        const dbTotal = Number((etlRollup as Record<string, unknown>).db_total_queries ?? 0);

        return {
          dataSourceStatus: {
            mode: "real_telemetry",
            source: "ETL table: system_health_rollups",
            details: "Metrics loaded from scheduled ETL rollup data.",
            updatedAt: String((etlRollup as Record<string, unknown>).captured_at ?? nowIso),
          },
          edgeFunctions: {
            confidence: "high",
            totalCalls: edgeTotal,
            successRate: edgeTotal > 0 ? ((edgeTotal - edgeErrors) / edgeTotal) * 100 : 100,
            avgResponseTime: Number((etlRollup as Record<string, unknown>).edge_avg_latency_ms ?? 0),
            errors: edgeErrors,
            recentLogs: [],
            responseTimeTrend: ((etlRollup as Record<string, unknown>).edge_latency_trend as TimeSeriesData[] | null) ?? [],
            requestsTrend: ((etlRollup as Record<string, unknown>).edge_request_trend as TimeSeriesData[] | null) ?? [],
            statusDistribution: [
              { name: "Success", value: Math.max(edgeTotal - edgeErrors, 0), color: "hsl(var(--chart-1))" },
              { name: "Errors", value: edgeErrors, color: "hsl(var(--destructive))" }
            ]
          },
          database: {
            confidence: "high",
            totalQueries: dbTotal,
            errorCount: dbErrors,
            warningCount: dbWarnings,
            recentLogs: [],
            severityDistribution: [
              { name: "Normal", value: Math.max(dbTotal - dbWarnings - dbErrors, 0), color: "hsl(var(--chart-1))" },
              { name: "Warnings", value: dbWarnings, color: "hsl(var(--chart-3))" },
              { name: "Errors", value: dbErrors, color: "hsl(var(--destructive))" }
            ]
          },
          auth: {
            confidence: "high",
            totalRequests: authTotal,
            successRate: authTotal > 0 ? ((authTotal - authFailed) / authTotal) * 100 : 100,
            failedAttempts: authFailed,
            recentLogs: [],
            requestsTrend: ((etlRollup as Record<string, unknown>).auth_request_trend as TimeSeriesData[] | null) ?? [],
            statusDistribution: [
              { name: "Success", value: Math.max(authTotal - authFailed, 0), color: "hsl(var(--chart-1))" },
              { name: "Failed", value: authFailed, color: "hsl(var(--destructive))" }
            ]
          }
        };
      }

      // Second preference: backend endpoint with curated telemetry.
      const { data: endpointMetrics, error: endpointError } = await supabase.functions.invoke("system-health-metrics", {
        body: { timeRange }
      });

      if (!endpointError && endpointMetrics) {
        const typedMetrics = endpointMetrics as EndpointHealthMetrics;
        const edge = typedMetrics.edgeFunctions ?? {};
        const db = typedMetrics.database ?? {};
        const auth = typedMetrics.auth ?? {};

        return {
          dataSourceStatus: {
            mode: "real_telemetry",
            source: "Backend endpoint: system-health-metrics",
            details: "Metrics loaded from backend telemetry endpoint.",
            updatedAt: String(typedMetrics.updatedAt ?? nowIso)
          },
          edgeFunctions: {
            confidence: "high",
            totalCalls: Number(edge.totalCalls ?? 0),
            successRate: Number(edge.successRate ?? 0),
            avgResponseTime: Number(edge.avgResponseTime ?? 0),
            errors: Number(edge.errors ?? 0),
            recentLogs: (edge.recentLogs as EdgeFunctionLog[] | undefined) ?? [],
            responseTimeTrend: (edge.responseTimeTrend as TimeSeriesData[] | undefined) ?? [],
            requestsTrend: (edge.requestsTrend as TimeSeriesData[] | undefined) ?? [],
            statusDistribution: (edge.statusDistribution as StatusDistribution[] | undefined) ?? []
          },
          database: {
            confidence: "high",
            totalQueries: Number(db.totalQueries ?? 0),
            errorCount: Number(db.errorCount ?? 0),
            warningCount: Number(db.warningCount ?? 0),
            recentLogs: (db.recentLogs as DatabaseLog[] | undefined) ?? [],
            severityDistribution: (db.severityDistribution as StatusDistribution[] | undefined) ?? []
          },
          auth: {
            confidence: "high",
            totalRequests: Number(auth.totalRequests ?? 0),
            successRate: Number(auth.successRate ?? 0),
            failedAttempts: Number(auth.failedAttempts ?? 0),
            recentLogs: (auth.recentLogs as AuthLog[] | undefined) ?? [],
            requestsTrend: (auth.requestsTrend as TimeSeriesData[] | undefined) ?? [],
            statusDistribution: (auth.statusDistribution as StatusDistribution[] | undefined) ?? []
          }
        };
      }

      // Limited fallback mode (no synthetic/random trend generation).
      const { data: recentTransactions } = await supabase
        .from('transactions')
        .select('id, created_at, status')
        .order('created_at', { ascending: false })
        .limit(50);

      // Fetch recent enrollments
      const { data: recentEnrollments } = await supabase
        .from('course_enrollments')
        .select('id, enrolled_at')
        .order('enrolled_at', { ascending: false })
        .limit(50);

      // Fetch recent credit transactions
      const { data: recentCredits } = await supabase
        .from('credit_transactions')
        .select('id, created_at, transaction_type')
        .order('created_at', { ascending: false })
        .limit(50);

      // Calculate metrics based on available data
      const totalDbOperations = (recentTransactions?.length || 0) + 
        (recentEnrollments?.length || 0) + 
        (recentCredits?.length || 0);

      const failedTransactions = recentTransactions?.filter(t => t.status === 'failed').length || 0;

      return {
        dataSourceStatus: {
          mode: "fallback",
          source: "Application activity fallback",
          details: "ETL table and backend telemetry endpoint unavailable; edge/auth data is limited.",
          updatedAt: nowIso
        },
        edgeFunctions: {
          confidence: "low",
          totalCalls: 0,
          successRate: 0,
          avgResponseTime: 0,
          errors: 0,
          recentLogs: [],
          responseTimeTrend: [],
          requestsTrend: [],
          statusDistribution: [
            { name: 'Success', value: 0, color: 'hsl(var(--chart-1))' },
            { name: 'Errors', value: 0, color: 'hsl(var(--destructive))' }
          ]
        },
        database: {
          confidence: "medium",
          totalQueries: totalDbOperations,
          errorCount: failedTransactions,
          warningCount: 0,
          recentLogs: (recentTransactions || []).slice(0, 10).map((t) => ({
            identifier: t.id,
            timestamp: t.created_at,
            event_message: `Transaction ${t.status}`,
            error_severity: t.status === 'failed' ? 'ERROR' : 'LOG'
          })),
          severityDistribution: [
            { name: 'Normal', value: totalDbOperations - failedTransactions, color: 'hsl(var(--chart-1))' },
            { name: 'Warnings', value: 0, color: 'hsl(var(--chart-3))' },
            { name: 'Errors', value: failedTransactions, color: 'hsl(var(--destructive))' }
          ]
        },
        auth: {
          confidence: "low",
          totalRequests: 0,
          successRate: 0,
          failedAttempts: 0,
          recentLogs: [],
          requestsTrend: [],
          statusDistribution: [
            { name: 'Success', value: 0, color: 'hsl(var(--chart-1))' },
            { name: 'Failed', value: 0, color: 'hsl(var(--destructive))' }
          ]
        }
      };
    },
    refetchInterval: autoRefresh ? 30000 : false,
    staleTime: 10000,
  });

  const getStatusBadge = (rate: number) => {
    if (rate >= 99) return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" /> Healthy</Badge>;
    if (rate >= 95) return <Badge className="bg-yellow-100 text-yellow-700"><AlertTriangle className="w-3 h-3 mr-1" /> Warning</Badge>;
    return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" /> Critical</Badge>;
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'ERROR':
      case 'FATAL':
        return <Badge variant="destructive">Error</Badge>;
      case 'WARNING':
        return <Badge className="bg-yellow-100 text-yellow-700">Warning</Badge>;
      case 'INFO':
      case 'LOG':
        return <Badge variant="secondary">Info</Badge>;
      default:
        return <Badge variant="outline">{severity || 'Unknown'}</Badge>;
    }
  };

  const formatTimestamp = (ts: string | number) => {
    try {
      const date = typeof ts === 'number' ? new Date(ts / 1000) : new Date(ts);
      return date.toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  const getConfidenceBadge = (level: ConfidenceLevel) => {
    if (level === "high") return <Badge className="bg-green-100 text-green-700">Confidence: High</Badge>;
    if (level === "medium") return <Badge className="bg-yellow-100 text-yellow-700">Confidence: Medium</Badge>;
    return <Badge variant="secondary">Confidence: Low</Badge>;
  };

  const dataSourceBanner = useMemo(() => {
    if (!healthData) return null;
    const isRealTelemetry = healthData.dataSourceStatus.mode === "real_telemetry";
    const Icon = isRealTelemetry ? ShieldCheck : ShieldAlert;

    return (
      <Card className={`mb-6 ${isRealTelemetry ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20" : "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"}`}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Icon className={`w-5 h-5 mt-0.5 ${isRealTelemetry ? "text-green-500" : "text-amber-500"}`} />
            <div>
              <p className={`text-sm font-medium ${isRealTelemetry ? "text-green-700 dark:text-green-300" : "text-amber-700 dark:text-amber-300"}`}>
                HealthDataSourceStatus: {isRealTelemetry ? "Real telemetry" : "Limited fallback mode"}
              </p>
              <p className={`text-xs mt-1 ${isRealTelemetry ? "text-green-600/80 dark:text-green-400/80" : "text-amber-700/80 dark:text-amber-400/80"}`}>
                Source: {healthData.dataSourceStatus.source}. {healthData.dataSourceStatus.details}
              </p>
              <p className={`text-xs mt-1 ${isRealTelemetry ? "text-green-600/80 dark:text-green-400/80" : "text-amber-700/80 dark:text-amber-400/80"}`}>
                Last updated: {formatTimestamp(healthData.dataSourceStatus.updatedAt)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }, [healthData]);

  return (
    <DashboardLayout sidebarSections={adminSidebarSections} brandName="Admin Panel">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              System Health
            </h1>
            <p className="text-muted-foreground">Monitor edge functions, database, and authentication performance</p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last 1 hour</SelectItem>
                <SelectItem value="6h">Last 6 hours</SelectItem>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto' : 'Manual'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetch();
                toast.success("Refreshed health metrics");
              }}
              disabled={isRefetching}
            >
              <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {dataSourceBanner}

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Zap className="w-5 h-5 text-blue-500" />
              <div className="flex flex-col items-end gap-1">
                {healthData && getStatusBadge(healthData.edgeFunctions.successRate)}
                {healthData && getConfidenceBadge(healthData.edgeFunctions.confidence)}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : `${healthData?.edgeFunctions.successRate.toFixed(1)}%`}</div>
            <p className="text-xs text-muted-foreground">Edge Function Success Rate</p>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">{healthData?.edgeFunctions.totalCalls || 0} calls</span>
              {(healthData?.edgeFunctions.errors || 0) > 0 && (
                <span className="text-red-500">{healthData?.edgeFunctions.errors} errors</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Clock className="w-5 h-5 text-purple-500" />
              <div className="flex flex-col items-end gap-1">
                <Badge variant="outline">{healthData?.edgeFunctions.avgResponseTime || 0}ms</Badge>
                {healthData && getConfidenceBadge(healthData.edgeFunctions.confidence)}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : `${healthData?.edgeFunctions.avgResponseTime || 0}ms`}</div>
            <p className="text-xs text-muted-foreground">Avg Response Time</p>
            <div className="mt-2 flex items-center gap-1 text-xs">
              {(healthData?.edgeFunctions.avgResponseTime || 0) < 500 ? (
                <><TrendingDown className="w-3 h-3 text-green-500" /> <span className="text-green-500">Fast</span></>
              ) : (
                <><TrendingUp className="w-3 h-3 text-yellow-500" /> <span className="text-yellow-500">Slow</span></>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Database className="w-5 h-5 text-green-500" />
              <div className="flex flex-col items-end gap-1">
                {healthData && (healthData.database.errorCount === 0
                  ? <Badge className="bg-green-100 text-green-700">Healthy</Badge>
                  : <Badge variant="destructive">{healthData.database.errorCount} errors</Badge>
                )}
                {healthData && getConfidenceBadge(healthData.database.confidence)}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : healthData?.database.totalQueries || 0}</div>
            <p className="text-xs text-muted-foreground">Database Operations</p>
            <div className="mt-2 flex items-center gap-2 text-xs">
              {(healthData?.database.warningCount || 0) > 0 && (
                <span className="text-yellow-500">{healthData?.database.warningCount} warnings</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Server className="w-5 h-5 text-orange-500" />
              <div className="flex flex-col items-end gap-1">
                {healthData && getStatusBadge(healthData.auth.successRate)}
                {healthData && getConfidenceBadge(healthData.auth.confidence)}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : `${healthData?.auth.successRate.toFixed(1)}%`}</div>
            <p className="text-xs text-muted-foreground">Auth Success Rate</p>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">{healthData?.auth.totalRequests || 0} requests</span>
              {(healthData?.auth.failedAttempts || 0) > 0 && (
                <span className="text-red-500">{healthData?.auth.failedAttempts} failed</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {/* Response Time Trend */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Response Time Trend</CardTitle>
            </div>
            <CardDescription className="text-xs">Edge function response times (ms)</CardDescription>
            {healthData && getConfidenceBadge(healthData.edgeFunctions.confidence)}
          </CardHeader>
          <CardContent>
            {healthData?.edgeFunctions.responseTimeTrend.length ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={healthData.edgeFunctions.responseTimeTrend}>
                  <defs>
                    <linearGradient id="colorResponseTime" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#colorResponseTime)"
                    name="Avg Response Time (ms)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Request Volume */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Request Volume</CardTitle>
            </div>
            <CardDescription className="text-xs">Edge function calls over time</CardDescription>
            {healthData && getConfidenceBadge(healthData.edgeFunctions.confidence)}
          </CardHeader>
          <CardContent>
            {healthData?.edgeFunctions.requestsTrend.length ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={healthData.edgeFunctions.requestsTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Bar dataKey="value" fill="hsl(var(--chart-1))" name="Requests" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="errors" fill="hsl(var(--destructive))" name="Errors" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Status Distribution</CardTitle>
            </div>
            <CardDescription className="text-xs">Edge function success vs errors</CardDescription>
            {healthData && getConfidenceBadge(healthData.edgeFunctions.confidence)}
          </CardHeader>
          <CardContent>
            {healthData?.edgeFunctions.statusDistribution.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={healthData.edgeFunctions.statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {healthData.edgeFunctions.statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Database Severity Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Database Health</CardTitle>
            </div>
            <CardDescription className="text-xs">Log severity distribution</CardDescription>
            {healthData && getConfidenceBadge(healthData.database.confidence)}
          </CardHeader>
          <CardContent>
            {healthData?.database.severityDistribution.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={healthData.database.severityDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {healthData.database.severityDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Auth Request Trend */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Auth Requests</CardTitle>
            </div>
            <CardDescription className="text-xs">Authentication attempts over time</CardDescription>
            {healthData && getConfidenceBadge(healthData.auth.confidence)}
          </CardHeader>
          <CardContent>
            {healthData?.auth.requestsTrend.length ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={healthData.auth.requestsTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Bar dataKey="value" fill="hsl(var(--chart-2))" name="Total" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="errors" fill="hsl(var(--destructive))" name="Failed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Auth Status Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Auth Success Rate</CardTitle>
            </div>
            <CardDescription className="text-xs">Success vs failed authentications</CardDescription>
            {healthData && getConfidenceBadge(healthData.auth.confidence)}
          </CardHeader>
          <CardContent>
            {healthData?.auth.statusDistribution.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={healthData.auth.statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {healthData.auth.statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Logs */}
      <Tabs defaultValue="edge-functions" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="edge-functions">
            <Zap className="w-4 h-4 mr-2" />
            Edge Functions
          </TabsTrigger>
          <TabsTrigger value="database">
            <Database className="w-4 h-4 mr-2" />
            Database
          </TabsTrigger>
          <TabsTrigger value="auth">
            <Server className="w-4 h-4 mr-2" />
            Auth
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edge-functions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Edge Function Logs</CardTitle>
              <CardDescription>Recent edge function executions and performance</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading logs...</div>
              ) : healthData?.edgeFunctions.recentLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No edge function logs found.</p>
                  <p className="text-xs mt-2">Logs will appear here when edge functions are called.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground border-b">
                      <tr>
                        <th className="py-3 px-2">Time</th>
                        <th className="py-3 px-2">Function</th>
                        <th className="py-3 px-2">Status</th>
                        <th className="py-3 px-2">Duration</th>
                        <th className="py-3 px-2">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {healthData?.edgeFunctions.recentLogs.map((log, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2 text-xs text-muted-foreground">
                            {formatTimestamp(log.timestamp)}
                          </td>
                          <td className="py-2 px-2 font-mono text-xs">{log.function_name}</td>
                          <td className="py-2 px-2">
                            {log.status_code ? (
                              <Badge variant={log.status_code < 400 ? "default" : "destructive"}>
                                {log.status_code}
                              </Badge>
                            ) : (
                              <Badge variant="outline">{log.event_type}</Badge>
                            )}
                          </td>
                          <td className="py-2 px-2 text-xs">
                            {log.execution_time_ms ? `${log.execution_time_ms}ms` : '-'}
                          </td>
                          <td className="py-2 px-2 text-xs truncate max-w-xs">{log.event_message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Database Logs</CardTitle>
              <CardDescription>Recent database queries and errors</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading logs...</div>
              ) : healthData?.database.recentLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No database logs found.</p>
                  <p className="text-xs mt-2">Database activity will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground border-b">
                      <tr>
                        <th className="py-3 px-2">Time</th>
                        <th className="py-3 px-2">Severity</th>
                        <th className="py-3 px-2">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {healthData?.database.recentLogs.map((log, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2 text-xs text-muted-foreground">
                            {formatTimestamp(log.timestamp)}
                          </td>
                          <td className="py-2 px-2">{getSeverityBadge(log.error_severity)}</td>
                          <td className="py-2 px-2 text-xs truncate max-w-md">{log.event_message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auth" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Authentication Logs</CardTitle>
              <CardDescription>Recent authentication attempts and events</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading logs...</div>
              ) : healthData?.auth.recentLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No authentication logs found.</p>
                  <p className="text-xs mt-2">Auth activity will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground border-b">
                      <tr>
                        <th className="py-3 px-2">Time</th>
                        <th className="py-3 px-2">Path</th>
                        <th className="py-3 px-2">Status</th>
                        <th className="py-3 px-2">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {healthData?.auth.recentLogs.map((log, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2 text-xs text-muted-foreground">
                            {formatTimestamp(log.timestamp)}
                          </td>
                          <td className="py-2 px-2 font-mono text-xs">{log.path}</td>
                          <td className="py-2 px-2">
                            <Badge variant={log.status < 400 ? "default" : "destructive"}>
                              {log.status}
                            </Badge>
                          </td>
                          <td className="py-2 px-2 text-xs truncate max-w-xs">
                            {log.error || log.msg || log.event_message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* System Info */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>System Information</CardTitle>
          <CardDescription>Platform configuration and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Project ID</p>
              <p className="font-mono text-sm">vbrxgaxjmpwusbbbzzgl</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Region</p>
              <p className="text-sm">Supabase Cloud</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Last Refresh</p>
              <p className="text-sm">{new Date().toLocaleString()}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Auto Refresh</p>
              <p className="text-sm">{autoRefresh ? 'Every 30s' : 'Disabled'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
