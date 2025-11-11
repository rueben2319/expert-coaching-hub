import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { coachSidebarSections } from "@/config/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { BookOpen, Users, TrendingUp, Clock, Target, Award, BarChart3, Calendar, Banknote, Hourglass } from "lucide-react";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent
} from "@/components/ui/chart";
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  ResponsiveContainer
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCredits } from "@/hooks/useCredits";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { WithdrawalAnalytics } from "@/components/WithdrawalAnalytics";

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(142, 76%, 36%)", "hsl(24, 95%, 53%)", "hsl(262, 83%, 58%)"];

export default function CoachAnalytics() {
  const { user } = useAuth();
    const { wallet, transactions, withdrawalRequests } = useCredits();
  
  // Fetch courses with modules and lessons
  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ["coach-courses-analytics", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          *,
          course_modules(
            *,
            lessons(*)
          )
        `)
        .eq("coach_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch enrollments with detailed student progress
  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["coach-enrollments-analytics", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_enrollments")
        .select(`
          *,
          courses!inner(
            id,
            title,
            coach_id,
            course_modules(
              id,
              lessons(id)
            )
          ),
          profiles(full_name, email)
        `)
        .eq("courses.coach_id", user!.id)
        .order("enrolled_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch all lesson progress for enrolled students
  const { data: lessonProgress, isLoading: progressLoading } = useQuery({
    queryKey: ["coach-lesson-progress", user?.id],
    queryFn: async () => {
      if (!enrollments) return [];
      const userIds = enrollments.map(e => e.user_id);
      if (userIds.length === 0) return [];

      const { data, error } = await supabase
        .from("lesson_progress")
        .select(`
          *,
          lessons!inner(
            id,
            estimated_duration,
            module_id,
            course_modules!inner(
              course_id,
              courses!inner(coach_id)
            )
          )
        `)
        .in("user_id", userIds)
        .eq("lessons.course_modules.courses.coach_id", user!.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!enrollments,
  });

      const financialData = useMemo(() => {
        if (!wallet || !transactions || !withdrawalRequests) return null;

    const earningsByMonth = new Map<string, number>();
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - i));
      return date.toISOString().slice(0, 7);
    });

    last6Months.forEach(month => earningsByMonth.set(month, 0));

    transactions.forEach(transaction => {
      if (transaction.transaction_type === 'course_enrollment') {
        const month = new Date(transaction.created_at).toISOString().slice(0, 7);
        if (earningsByMonth.has(month)) {
          earningsByMonth.set(month, (earningsByMonth.get(month) || 0) + transaction.amount);
        }
      }
    });

    const earningsTrend = Array.from(earningsByMonth.entries()).map(([month, earnings]) => ({
      month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short" }),
      earnings: earnings
    }));

    return {
      totalEarned: wallet.total_earned || 0,
      pendingWithdrawal: wallet.balance || 0,
      totalWithdrawn: (wallet.total_earned || 0) - (wallet.balance || 0),
      earningsTrend
    };
  }, [wallet, transactions]);

  const analyticsData = useMemo(() => {
    if (!courses || !enrollments || !lessonProgress) return null;

    // Enrollment trend over time (last 6 months)
    const enrollmentsByMonth = new Map<string, number>();
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - i));
      return date.toISOString().slice(0, 7);
    });

    last6Months.forEach(month => enrollmentsByMonth.set(month, 0));

    enrollments.forEach(enrollment => {
      const month = new Date(enrollment.enrolled_at).toISOString().slice(0, 7);
      if (enrollmentsByMonth.has(month)) {
        enrollmentsByMonth.set(month, (enrollmentsByMonth.get(month) || 0) + 1);
      }
    });

    const enrollmentTrend = Array.from(enrollmentsByMonth.entries()).map(([month, count]) => ({
      month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short" }),
      enrollments: count
    }));

    // Course performance comparison
    const coursePerformance = courses.map(course => {
      const courseEnrollments = enrollments.filter(e => e.courses?.id === course.id);
      const courseLessons = course.course_modules?.flatMap(m => m.lessons || []) || [];
      
      const completedStudents = courseEnrollments.filter(enrollment => {
        const studentProgress = lessonProgress.filter(lp => 
          lp.user_id === enrollment.user_id &&
          courseLessons.some(lesson => lesson.id === lp.lesson_id)
        );
        
        const completedLessons = studentProgress.filter(p => p.is_completed).length;
        return courseLessons.length > 0 && completedLessons === courseLessons.length;
      }).length;

      const avgProgress = courseEnrollments.length > 0
        ? courseEnrollments.reduce((sum, enrollment) => {
            const studentProgress = lessonProgress.filter(lp => 
              lp.user_id === enrollment.user_id &&
              courseLessons.some(lesson => lesson.id === lp.lesson_id)
            );
            const completedLessons = studentProgress.filter(p => p.is_completed).length;
            return sum + (courseLessons.length > 0 ? (completedLessons / courseLessons.length) * 100 : 0);
          }, 0) / courseEnrollments.length
        : 0;

      return {
        name: course.title.length > 20 ? course.title.substring(0, 20) + "..." : course.title,
        students: courseEnrollments.length,
        completed: completedStudents,
        avgProgress: Math.round(avgProgress)
      };
    });

    // Student progress distribution
    const progressBuckets = { "0-25%": 0, "26-50%": 0, "51-75%": 0, "76-99%": 0, "100%": 0 };
    
    enrollments.forEach(enrollment => {
      const courseLessons = enrollment.courses?.course_modules?.flatMap((m: any) => m.lessons || []) || [];
      const studentProgress = lessonProgress.filter(lp => 
        lp.user_id === enrollment.user_id &&
        courseLessons.some((lesson: any) => lesson.id === lp.lesson_id)
      );
      
      const completedLessons = studentProgress.filter(p => p.is_completed).length;
      const progress = courseLessons.length > 0 ? (completedLessons / courseLessons.length) * 100 : 0;

      if (progress === 100) progressBuckets["100%"]++;
      else if (progress >= 76) progressBuckets["76-99%"]++;
      else if (progress >= 51) progressBuckets["51-75%"]++;
      else if (progress >= 26) progressBuckets["26-50%"]++;
      else progressBuckets["0-25%"]++;
    });

    const progressDistribution = Object.entries(progressBuckets).map(([range, count]) => ({
      range,
      students: count
    }));

    // Calculate key metrics
    const totalStudents = enrollments.length;
    const activeStudents = new Set(lessonProgress.map(p => p.user_id)).size;
    const completionRate = enrollments.length > 0
      ? (progressBuckets["100%"] / enrollments.length) * 100
      : 0;
    const avgStudyTime = lessonProgress.reduce((sum, p) => 
      sum + (p.lessons?.estimated_duration || 0), 0
    ) / (totalStudents || 1);

    return {
      enrollmentTrend,
      coursePerformance,
      progressDistribution,
      totalStudents,
      activeStudents,
      completionRate,
      avgStudyTime
    };
  }, [courses, enrollments, lessonProgress]);

  const isLoading = coursesLoading || enrollmentsLoading || progressLoading;

    return (
    <DashboardLayout sidebarSections={coachSidebarSections}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Track your coaching performance and student progress</p>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="financials">Financials</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-6">

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-muted/30 rounded-lg p-6 animate-pulse">
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-6 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            ))
          ) : analyticsData ? (
            [
              {
                title: "Total Students",
                value: analyticsData.totalStudents.toString(),
                icon: Users,
                color: "text-primary"
              },
              {
                title: "Active Students",
                value: analyticsData.activeStudents.toString(),
                icon: TrendingUp,
                color: "text-green-600"
              },
              {
                title: "Completion Rate",
                value: `${Math.round(analyticsData.completionRate)}%`,
                icon: Award,
                color: "text-accent"
              },
              {
                title: "Avg Study Time",
                value: `${Math.round(analyticsData.avgStudyTime)}m`,
                icon: Clock,
                color: "text-blue-600"
              }
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="bg-muted/30 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                    <div className={`w-12 h-12 bg-muted rounded-lg flex items-center justify-center ${stat.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                </div>
              );
            })
          ) : null}
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Enrollment Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Enrollment Trend
              </CardTitle>
              <CardDescription>Student enrollments over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : analyticsData ? (
                <ChartContainer
                  config={{
                    enrollments: {
                      label: "Enrollments",
                      color: "hsl(var(--primary))",
                    },
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analyticsData.enrollmentTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line 
                        type="monotone" 
                        dataKey="enrollments" 
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

          {/* Progress Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Student Progress Distribution
              </CardTitle>
              <CardDescription>How students are progressing through courses</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : analyticsData ? (
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
                    <BarChart data={analyticsData.progressDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="students" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Course Performance Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Course Performance Comparison
            </CardTitle>
            <CardDescription>Compare enrollment and completion rates across your courses</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-2 bg-muted rounded"></div>
                  </div>
                ))}
              </div>
            ) : analyticsData?.coursePerformance.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No course data available yet</p>
            ) : analyticsData ? (
              <div className="space-y-4">
                {analyticsData.coursePerformance.map((course, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{course.name}</h4>
                        <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                          <span>{course.students} enrolled</span>
                          <span>{course.completed} completed</span>
                        </div>
                      </div>
                      <Badge variant={course.avgProgress >= 75 ? "default" : "secondary"}>
                        {course.avgProgress}% avg
                      </Badge>
                    </div>
                    <Progress value={Math.max(course.avgProgress, 5)} className="h-2" />
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Key Insights
            </CardTitle>
            <CardDescription>Actionable recommendations based on your analytics</CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsData && (
              <div className="space-y-4">
                {analyticsData.completionRate < 50 && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="font-medium text-sm">Low completion rate detected</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Only {Math.round(analyticsData.completionRate)}% of students complete their courses. 
                      Consider adding more engaging content or breaking lessons into smaller chunks.
                    </p>
                  </div>
                )}
                
                {analyticsData.activeStudents < analyticsData.totalStudents * 0.5 && analyticsData.totalStudents > 0 && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="font-medium text-sm">Low student engagement</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.round((analyticsData.activeStudents / analyticsData.totalStudents) * 100)}% of your students are actively learning. 
                      Try sending reminders or creating discussion forums to boost engagement.
                    </p>
                  </div>
                )}

                {analyticsData.completionRate >= 75 && (
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="font-medium text-sm">Excellent completion rate! 🎉</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.round(analyticsData.completionRate)}% of students complete their courses. 
                      Your content is highly engaging and effective.
                    </p>
                  </div>
                )}

                {analyticsData.coursePerformance.length === 0 && (
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">
                      Create courses and enroll students to see insights here
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="financials" className="mt-6 space-y-6">
            {/* Financial Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-muted/30 rounded-lg p-6 animate-pulse">
                    <div className="space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-6 bg-muted rounded w-1/2"></div>
                    </div>
                  </div>
                ))
              ) : financialData ? (
                [
                  {
                    title: "Total Earnings",
                    value: `CR ${financialData.totalEarned.toLocaleString()}`,
                    icon: Banknote,
                    color: "text-primary"
                  },
                  {
                    title: "Available for Withdrawal",
                    value: `CR ${financialData.pendingWithdrawal.toLocaleString()}`,
                    icon: Hourglass,
                    color: "text-amber-600"
                  },
                  {
                    title: "Total Withdrawn",
                    value: `CR ${financialData.totalWithdrawn.toLocaleString()}`,
                    icon: TrendingUp,
                    color: "text-green-600"
                  }
                ].map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <div key={i} className="bg-muted/30 rounded-lg p-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">{stat.title}</p>
                          <p className="text-2xl font-bold">{stat.value}</p>
                        </div>
                        <div className={`w-12 h-12 bg-muted rounded-lg flex items-center justify-center ${stat.color}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : null}
            </div>

            {/* Earnings Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Earnings Trend
                </CardTitle>
                <CardDescription>Your earnings from course enrollments over the last 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
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

            {/* Recent Withdrawals */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="h-5 w-5" />
                  Recent Withdrawals
                </CardTitle>
                <CardDescription>Your recent withdrawal requests</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount (CR)</TableHead>
                      <TableHead>Amount (MWK)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                                        {withdrawalRequests?.slice(0, 5).map(withdrawal => (
                      <TableRow key={withdrawal.id}>
                        <TableCell>{new Date(withdrawal.created_at).toLocaleDateString()}</TableCell>
                                                <TableCell>{withdrawal.credits_amount.toLocaleString()}</TableCell>
                                                <TableCell>{withdrawal.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={withdrawal.status === 'completed' ? 'default' : 'secondary'}>
                            {withdrawal.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdrawals Tab */}
          <TabsContent value="withdrawals" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Withdrawal Analytics</h2>
              <p className="text-muted-foreground">
                Track your withdrawal performance, success rates, and trends
              </p>
            </div>
            <WithdrawalAnalytics coachId={user?.id} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
