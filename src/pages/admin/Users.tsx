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

const defaultAnalytics = {
  totalUsers: 0,
  coachCount: 0,
  adminCount: 0,
  uniqueEnrolledUsers: 0,
  roleData: [],
  signupTrendData: [],
  engagementData: [],
};

export default function AdminUsers() {
  const { data: analytics, isLoading } = useAdminUserAnalytics();
  const currentAnalytics = analytics ?? defaultAnalytics;
  const totalUsers = currentAnalytics.totalUsers || 0;

  return (
    <DashboardLayout sidebarSections={adminSidebarSections} brandName="Admin Panel">
      <div className="mb-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              User Analytics
            </h1>
            <p className="text-muted-foreground">Platform user demographics and engagement insights</p>
          </div>
          <div className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
            Last 6 months
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
          Loading analytics...
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Key platform metrics
              </h2>
              <span className="text-xs text-muted-foreground">Updated hourly</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="hover:shadow-md transition-all hover:scale-[1.02]">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalUsers}</div>
                  <p className="text-xs text-muted-foreground">Registered accounts</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-all hover:scale-[1.02]">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Coaches</CardTitle>
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{currentAnalytics.coachCount}</div>
                  <p className="text-xs text-muted-foreground">
                    {totalUsers ? `${Math.round((currentAnalytics.coachCount / totalUsers) * 100)}% of total` : 'Content creators'}
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-all hover:scale-[1.02]">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Engaged Users</CardTitle>
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{currentAnalytics.uniqueEnrolledUsers}</div>
                  <p className="text-xs text-muted-foreground">
                    {totalUsers ? `${Math.round((currentAnalytics.uniqueEnrolledUsers / totalUsers) * 100)}% enrolled` : 'Enrolled in courses'}
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-all hover:scale-[1.02]">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Admins</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{currentAnalytics.adminCount}</div>
                  <p className="text-xs text-muted-foreground">
                    {totalUsers ? `${Math.round((currentAnalytics.adminCount / totalUsers) * 100)}% of platform` : 'Platform managers'}
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Audience mix
              </h2>
              <Suspense
                fallback={
                  <AdminUserChartSkeleton
                    title="Role Distribution"
                    description="Breakdown of user types on the platform"
                  />
                }
              >
                <RoleDistributionChart data={currentAnalytics.roleData || []} />
              </Suspense>
            </section>

            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Engagement overview
              </h2>
              <Suspense
                fallback={
                  <AdminUserChartSkeleton
                    title="User Engagement"
                    description="Active user metrics"
                  />
                }
              >
                <EngagementChart data={currentAnalytics.engagementData || []} />
              </Suspense>
            </section>
          </div>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Signup trend
            </h2>
            <Suspense
              fallback={
                <AdminUserChartSkeleton
                  title="Signup Trend"
                  description="New user registrations over the last 6 months"
                  heightClassName="h-[300px]"
                />
              }
            >
              <SignupTrendChart data={currentAnalytics.signupTrendData || []} />
            </Suspense>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
