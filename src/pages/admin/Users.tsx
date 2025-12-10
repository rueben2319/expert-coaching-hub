import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { adminSidebarSections } from '@/config/navigation';
import { Users, UserCheck, GraduationCap, Shield, TrendingUp, Calendar } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export default function AdminUsers() {
  // Fetch user demographics data
  const { data: demographics, isLoading } = useQuery({
    queryKey: ['admin-user-demographics'],
    queryFn: async () => {
      // Get total users count
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get role distribution
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role');

      const roleDistribution = {
        client: 0,
        coach: 0,
        admin: 0
      };
      roles?.forEach((r: any) => {
        if (r.role in roleDistribution) {
          roleDistribution[r.role as keyof typeof roleDistribution]++;
        }
      });

      // Get users with credit wallets (active users)
      const { count: activeWallets } = await supabase
        .from('credit_wallets')
        .select('*', { count: 'exact', head: true })
        .gt('balance', 0);

      // Get signups by month (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const { data: signups } = await supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', sixMonthsAgo.toISOString());

      // Group by month
      const monthlySignups: Record<string, number> = {};
      signups?.forEach((s: any) => {
        const month = new Date(s.created_at).toLocaleString('default', { month: 'short', year: '2-digit' });
        monthlySignups[month] = (monthlySignups[month] || 0) + 1;
      });

      // Get users with enrollments (engaged users)
      const { data: enrolledUsers } = await supabase
        .from('course_enrollments')
        .select('user_id');
      
      const uniqueEnrolledUsers = new Set(enrolledUsers?.map((e: any) => e.user_id)).size;

      // Get users who completed courses
      const { count: completedUsers } = await supabase
        .from('course_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

      return {
        totalUsers: totalUsers || 0,
        roleDistribution,
        activeWallets: activeWallets || 0,
        monthlySignups,
        uniqueEnrolledUsers,
        completedUsers: completedUsers || 0
      };
    }
  });

  const roleData = demographics ? [
    { name: 'Clients', value: demographics.roleDistribution.client, color: 'hsl(var(--primary))' },
    { name: 'Coaches', value: demographics.roleDistribution.coach, color: 'hsl(var(--accent))' },
    { name: 'Admins', value: demographics.roleDistribution.admin, color: 'hsl(var(--muted-foreground))' }
  ].filter(r => r.value > 0) : [];

  const signupTrendData = demographics 
    ? Object.entries(demographics.monthlySignups).map(([month, count]) => ({
        month,
        signups: count
      }))
    : [];

  const engagementData = demographics ? [
    { name: 'Enrolled', value: demographics.uniqueEnrolledUsers },
    { name: 'Completed', value: demographics.completedUsers },
    { name: 'With Balance', value: demographics.activeWallets }
  ] : [];

  return (
    <DashboardLayout sidebarSections={adminSidebarSections} brandName="Admin Panel">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          User Analytics
        </h1>
        <p className="text-muted-foreground">Platform user demographics and engagement insights</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading analytics...</div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{demographics?.totalUsers || 0}</div>
                <p className="text-xs text-muted-foreground">Registered accounts</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Coaches</CardTitle>
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{demographics?.roleDistribution.coach || 0}</div>
                <p className="text-xs text-muted-foreground">Content creators</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Engaged Users</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{demographics?.uniqueEnrolledUsers || 0}</div>
                <p className="text-xs text-muted-foreground">Enrolled in courses</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Admins</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{demographics?.roleDistribution.admin || 0}</div>
                <p className="text-xs text-muted-foreground">Platform managers</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 md:grid-cols-2 mb-8">
            {/* Role Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Role Distribution</CardTitle>
                <CardDescription>Breakdown of user types on the platform</CardDescription>
              </CardHeader>
              <CardContent>
                {roleData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={roleData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {roleData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    No role data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* User Engagement */}
            <Card>
              <CardHeader>
                <CardTitle>User Engagement</CardTitle>
                <CardDescription>Active user metrics</CardDescription>
              </CardHeader>
              <CardContent>
                {engagementData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={engagementData}>
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
                    No engagement data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Signup Trend */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle>Signup Trend</CardTitle>
                  <CardDescription>New user registrations over the last 6 months</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {signupTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={signupTrendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="signups" 
                      stroke="hsl(var(--primary))" 
                      fill="hsl(var(--primary))" 
                      fillOpacity={0.2} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No signup data available
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </DashboardLayout>
  );
}
