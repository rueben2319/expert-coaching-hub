import { lazy, Suspense } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { adminSidebarSections } from '@/config/navigation';
import { Users, UserCheck, GraduationCap, Shield } from 'lucide-react';
import { useAdminUserAnalytics } from '@/hooks/useAdminUserAnalytics';
import { AdminUserChartSkeleton } from '@/features/admin-user-analytics/components/AdminUserChartSkeleton';

const RoleDistributionChart = lazy(() =>
  import('@/features/admin-user-analytics/components/RoleDistributionChart').then((module) => ({
    default: module.RoleDistributionChart,
  })),
);

const EngagementChart = lazy(() =>
  import('@/features/admin-user-analytics/components/EngagementChart').then((module) => ({
    default: module.EngagementChart,
  })),
);

const SignupTrendChart = lazy(() =>
  import('@/features/admin-user-analytics/components/SignupTrendChart').then((module) => ({
    default: module.SignupTrendChart,
  })),
);

export default function AdminUsers() {
  const { data: analytics, isLoading } = useAdminUserAnalytics();

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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.totalUsers || 0}</div>
                <p className="text-xs text-muted-foreground">Registered accounts</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Coaches</CardTitle>
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.coachCount || 0}</div>
                <p className="text-xs text-muted-foreground">Content creators</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Engaged Users</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.uniqueEnrolledUsers || 0}</div>
                <p className="text-xs text-muted-foreground">Enrolled in courses</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Admins</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.adminCount || 0}</div>
                <p className="text-xs text-muted-foreground">Platform managers</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <Suspense
              fallback={
                <AdminUserChartSkeleton
                  title="Role Distribution"
                  description="Breakdown of user types on the platform"
                />
              }
            >
              <RoleDistributionChart data={analytics?.roleData || []} />
            </Suspense>

            <Suspense
              fallback={
                <AdminUserChartSkeleton
                  title="User Engagement"
                  description="Active user metrics"
                />
              }
            >
              <EngagementChart data={analytics?.engagementData || []} />
            </Suspense>
          </div>

          <Suspense
            fallback={
              <AdminUserChartSkeleton
                title="Signup Trend"
                description="New user registrations over the last 6 months"
                heightClassName="h-[300px]"
              />
            }
          >
            <SignupTrendChart data={analytics?.signupTrendData || []} />
          </Suspense>
        </>
      )}
    </DashboardLayout>
  );
}
