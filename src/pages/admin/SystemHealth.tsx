import { useState } from "react";
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
  BarChart3
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

interface HealthMetrics {
  edgeFunctions: {
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
    totalQueries: number;
    errorCount: number;
    warningCount: number;
    recentLogs: DatabaseLog[];
    severityDistribution: StatusDistribution[];
  };
  auth: {
    totalRequests: number;
    successRate: number;
    failedAttempts: number;
    recentLogs: AuthLog[];
    requestsTrend: TimeSeriesData[];
    statusDistribution: StatusDistribution[];
  };
}

export default function SystemHealth() {
  const [timeRange, setTimeRange] = useState("1h");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: healthData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["system-health", timeRange],
    queryFn: async (): Promise<HealthMetrics> => {
      // Fetch Edge Function logs
      const { data: edgeLogs } = await supabase
        .from('function_edge_logs' as any)
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      // Fetch Database logs  
      const { data: dbLogs } = await supabase
        .from('postgres_logs' as any)
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      // Fetch Auth logs
      const { data: authLogs } = await supabase
        .from('auth_logs' as any)
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      // Process edge function metrics
      const edgeFunctionLogs = (edgeLogs || []) as any[];
      const successfulCalls = edgeFunctionLogs.filter((l: any) => 
        l.response?.status_code >= 200 && l.response?.status_code < 400
      ).length;
      const totalEdgeCalls = edgeFunctionLogs.length;
      const edgeErrors = edgeFunctionLogs.filter((l: any) => 
        l.response?.status_code >= 400 || l.level === 'error'
      ).length;
      const avgTime = edgeFunctionLogs.reduce((sum: number, l: any) => 
        sum + (l.metadata?.execution_time_ms || 0), 0
      ) / Math.max(totalEdgeCalls, 1);

      // Process database metrics
      const databaseLogs = (dbLogs || []) as any[];
      const dbErrors = databaseLogs.filter((l: any) => 
        l.parsed?.error_severity === 'ERROR' || l.parsed?.error_severity === 'FATAL'
      ).length;
      const dbWarnings = databaseLogs.filter((l: any) => 
        l.parsed?.error_severity === 'WARNING'
      ).length;

      // Process auth metrics
      const authenticationLogs = (authLogs || []) as any[];
      const authSuccess = authenticationLogs.filter((l: any) => 
        l.metadata?.status >= 200 && l.metadata?.status < 400
      ).length;
      const authFailed = authenticationLogs.filter((l: any) => 
        l.metadata?.status >= 400
      ).length;

      // Generate time series data for edge functions
      const edgeTimeGroups: Record<string, { count: number; errors: number; totalTime: number }> = {};
      edgeFunctionLogs.forEach((l: any) => {
        const date = new Date(l.timestamp / 1000);
        const hour = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (!edgeTimeGroups[hour]) {
          edgeTimeGroups[hour] = { count: 0, errors: 0, totalTime: 0 };
        }
        edgeTimeGroups[hour].count++;
        if (l.response?.status_code >= 400 || l.level === 'error') {
          edgeTimeGroups[hour].errors++;
        }
        edgeTimeGroups[hour].totalTime += l.metadata?.execution_time_ms || 0;
      });

      const edgeResponseTimeTrend = Object.entries(edgeTimeGroups)
        .slice(-12)
        .map(([time, data]) => ({
          time,
          value: Math.round(data.totalTime / Math.max(data.count, 1)),
          errors: data.errors
        }));

      const edgeRequestsTrend = Object.entries(edgeTimeGroups)
        .slice(-12)
        .map(([time, data]) => ({
          time,
          value: data.count,
          errors: data.errors
        }));

      // Generate auth time series
      const authTimeGroups: Record<string, { success: number; failed: number }> = {};
      authenticationLogs.forEach((l: any) => {
        const date = new Date(l.timestamp);
        const hour = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (!authTimeGroups[hour]) {
          authTimeGroups[hour] = { success: 0, failed: 0 };
        }
        if (l.metadata?.status >= 200 && l.metadata?.status < 400) {
          authTimeGroups[hour].success++;
        } else {
          authTimeGroups[hour].failed++;
        }
      });

      const authRequestsTrend = Object.entries(authTimeGroups)
        .slice(-12)
        .map(([time, data]) => ({
          time,
          value: data.success + data.failed,
          errors: data.failed
        }));

      return {
        edgeFunctions: {
          totalCalls: totalEdgeCalls,
          successRate: totalEdgeCalls > 0 ? (successfulCalls / totalEdgeCalls) * 100 : 100,
          avgResponseTime: Math.round(avgTime),
          errors: edgeErrors,
          recentLogs: edgeFunctionLogs.slice(0, 20).map((l: any) => ({
            function_id: l.function_id || '',
            function_name: l.metadata?.function_id || 'Unknown',
            event_type: l.event_type || '',
            event_message: l.event_message || '',
            level: l.level || 'info',
            timestamp: l.timestamp || Date.now(),
            execution_time_ms: l.metadata?.execution_time_ms,
            status_code: l.response?.status_code
          })),
          responseTimeTrend: edgeResponseTimeTrend,
          requestsTrend: edgeRequestsTrend,
          statusDistribution: [
            { name: 'Success', value: successfulCalls, color: 'hsl(var(--chart-1))' },
            { name: 'Errors', value: edgeErrors, color: 'hsl(var(--destructive))' }
          ]
        },
        database: {
          totalQueries: databaseLogs.length,
          errorCount: dbErrors,
          warningCount: dbWarnings,
          recentLogs: databaseLogs.slice(0, 20).map((l: any) => ({
            identifier: l.identifier || '',
            timestamp: l.timestamp || '',
            event_message: l.event_message || '',
            error_severity: l.parsed?.error_severity || 'LOG'
          })),
          severityDistribution: [
            { name: 'Normal', value: databaseLogs.length - dbErrors - dbWarnings, color: 'hsl(var(--chart-1))' },
            { name: 'Warnings', value: dbWarnings, color: 'hsl(var(--chart-3))' },
            { name: 'Errors', value: dbErrors, color: 'hsl(var(--destructive))' }
          ]
        },
        auth: {
          totalRequests: authenticationLogs.length,
          successRate: authenticationLogs.length > 0 
            ? (authSuccess / authenticationLogs.length) * 100 
            : 100,
          failedAttempts: authFailed,
          recentLogs: authenticationLogs.slice(0, 20).map((l: any) => ({
            id: l.id || '',
            timestamp: l.timestamp || '',
            event_message: l.event_message || '',
            level: l.metadata?.level || 'info',
            status: l.metadata?.status || 0,
            path: l.metadata?.path || '',
            msg: l.metadata?.msg || '',
            error: l.metadata?.error || null
          })),
          requestsTrend: authRequestsTrend,
          statusDistribution: [
            { name: 'Success', value: authSuccess, color: 'hsl(var(--chart-1))' },
            { name: 'Failed', value: authFailed, color: 'hsl(var(--destructive))' }
          ]
        }
      };
    },
    refetchInterval: autoRefresh ? 30000 : false, // Auto-refresh every 30 seconds
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

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Zap className="w-5 h-5 text-blue-500" />
              {healthData && getStatusBadge(healthData.edgeFunctions.successRate)}
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
              <Badge variant="outline">{healthData?.edgeFunctions.avgResponseTime || 0}ms</Badge>
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
              {healthData && (healthData.database.errorCount === 0 
                ? <Badge className="bg-green-100 text-green-700">Healthy</Badge>
                : <Badge variant="destructive">{healthData.database.errorCount} errors</Badge>
              )}
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
              {healthData && getStatusBadge(healthData.auth.successRate)}
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