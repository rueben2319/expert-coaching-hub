import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminSidebarSections } from "@/config/navigation";
import { BookOpen, Users, TrendingUp, Star, DollarSign, BarChart3 } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminCourses() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["admin-course-analytics"],
    queryFn: async () => {
      // Get courses by status
      const { data: courses } = await supabase
        .from("courses")
        .select("status, level, is_free, price_credits, average_rating, category");

      const statusDistribution = { draft: 0, published: 0, archived: 0 };
      const levelDistribution = { introduction: 0, intermediate: 0, advanced: 0 };
      const pricingDistribution = { free: 0, paid: 0 };
      const categoryDistribution: Record<string, number> = {};
      let totalRating = 0;
      let ratedCourses = 0;

      courses?.forEach((c: any) => {
        // Status
        if (c.status in statusDistribution) {
          statusDistribution[c.status as keyof typeof statusDistribution]++;
        }
        // Level
        if (c.level && c.level in levelDistribution) {
          levelDistribution[c.level as keyof typeof levelDistribution]++;
        }
        // Pricing
        if (c.is_free) {
          pricingDistribution.free++;
        } else {
          pricingDistribution.paid++;
        }
        // Rating
        if (c.average_rating) {
          totalRating += Number(c.average_rating);
          ratedCourses++;
        }
        // Category
        const category = c.category || 'Uncategorized';
        categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;
      });

      // Get enrollment stats
      const { data: enrollments } = await supabase
        .from("course_enrollments")
        .select("status, progress_percentage");

      const enrollmentStatus = { active: 0, completed: 0, dropped: 0 };
      let totalProgress = 0;

      enrollments?.forEach((e: any) => {
        if (e.status in enrollmentStatus) {
          enrollmentStatus[e.status as keyof typeof enrollmentStatus]++;
        }
        totalProgress += e.progress_percentage || 0;
      });

      // Get top coaches by course count
      const { data: coachCounts } = await supabase
        .from("courses")
        .select("coach_id, coach:coach_id(full_name)")
        .eq("status", "published");

      const coachDistribution: Record<string, { name: string; count: number }> = {};
      coachCounts?.forEach((c: any) => {
        const coachName = c.coach?.full_name || 'Unknown';
        if (!coachDistribution[c.coach_id]) {
          coachDistribution[c.coach_id] = { name: coachName, count: 0 };
        }
        coachDistribution[c.coach_id].count++;
      });

      const topCoaches = Object.values(coachDistribution)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalCourses: courses?.length || 0,
        statusDistribution,
        levelDistribution,
        pricingDistribution,
        categoryDistribution,
        avgRating: ratedCourses > 0 ? (totalRating / ratedCourses).toFixed(1) : 'N/A',
        totalEnrollments: enrollments?.length || 0,
        enrollmentStatus,
        avgProgress: enrollments?.length ? Math.round(totalProgress / enrollments.length) : 0,
        topCoaches
      };
    }
  });

  const statusData = analytics ? [
    { name: 'Published', value: analytics.statusDistribution.published, color: 'hsl(var(--primary))' },
    { name: 'Draft', value: analytics.statusDistribution.draft, color: 'hsl(var(--muted-foreground))' },
    { name: 'Archived', value: analytics.statusDistribution.archived, color: 'hsl(var(--destructive))' }
  ].filter(s => s.value > 0) : [];

  const levelData = analytics ? [
    { name: 'Introduction', value: analytics.levelDistribution.introduction },
    { name: 'Intermediate', value: analytics.levelDistribution.intermediate },
    { name: 'Advanced', value: analytics.levelDistribution.advanced }
  ].filter(l => l.value > 0) : [];

  const enrollmentData = analytics ? [
    { name: 'Active', value: analytics.enrollmentStatus.active, color: 'hsl(var(--primary))' },
    { name: 'Completed', value: analytics.enrollmentStatus.completed, color: 'hsl(var(--accent))' },
    { name: 'Dropped', value: analytics.enrollmentStatus.dropped, color: 'hsl(var(--destructive))' }
  ].filter(e => e.value > 0) : [];

  const categoryData = analytics 
    ? Object.entries(analytics.categoryDistribution)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6)
    : [];

  return (
    <DashboardLayout sidebarSections={adminSidebarSections} brandName="Admin Panel">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Course Analytics
        </h1>
        <p className="text-muted-foreground">Platform course statistics and insights</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading analytics...</div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.totalCourses || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics?.statusDistribution.published || 0} published
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.totalEnrollments || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics?.enrollmentStatus.completed || 0} completed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg. Rating</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.avgRating}</div>
                <p className="text-xs text-muted-foreground">Out of 5 stars</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg. Progress</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.avgProgress || 0}%</div>
                <p className="text-xs text-muted-foreground">Completion rate</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 1 */}
          <div className="grid gap-6 md:grid-cols-2 mb-8">
            {/* Course Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Course Status</CardTitle>
                <CardDescription>Distribution by publication status</CardDescription>
              </CardHeader>
              <CardContent>
                {statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    No course data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Enrollment Status */}
            <Card>
              <CardHeader>
                <CardTitle>Enrollment Status</CardTitle>
                <CardDescription>Student enrollment breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                {enrollmentData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={enrollmentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {enrollmentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    No enrollment data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid gap-6 md:grid-cols-2 mb-8">
            {/* Courses by Level */}
            <Card>
              <CardHeader>
                <CardTitle>Courses by Level</CardTitle>
                <CardDescription>Difficulty distribution</CardDescription>
              </CardHeader>
              <CardContent>
                {levelData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={levelData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    No level data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Courses by Category */}
            <Card>
              <CardHeader>
                <CardTitle>Top Categories</CardTitle>
                <CardDescription>Most popular course categories</CardDescription>
              </CardHeader>
              <CardContent>
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={categoryData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis dataKey="name" type="category" className="text-xs" width={100} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Bar dataKey="value" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    No category data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Pricing & Top Coaches */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Pricing Distribution */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle>Pricing Model</CardTitle>
                    <CardDescription>Free vs paid courses</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Free Courses</span>
                    <span className="text-2xl font-bold">{analytics?.pricingDistribution.free || 0}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3">
                    <div 
                      className="bg-primary h-3 rounded-full" 
                      style={{ 
                        width: `${analytics?.totalCourses ? (analytics.pricingDistribution.free / analytics.totalCourses * 100) : 0}%` 
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Paid Courses</span>
                    <span className="text-2xl font-bold">{analytics?.pricingDistribution.paid || 0}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3">
                    <div 
                      className="bg-accent h-3 rounded-full" 
                      style={{ 
                        width: `${analytics?.totalCourses ? (analytics.pricingDistribution.paid / analytics.totalCourses * 100) : 0}%` 
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Coaches */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle>Top Coaches</CardTitle>
                    <CardDescription>By published course count</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {analytics?.topCoaches && analytics.topCoaches.length > 0 ? (
                  <div className="space-y-4">
                    {analytics.topCoaches.map((coach, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </div>
                          <span className="text-sm font-medium">{coach.name}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{coach.count} courses</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    No coach data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
