import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  EngagementPoint,
  RoleDistributionPoint,
  SignupTrendPoint,
} from '@/features/admin-user-analytics/types';

type SupportedRole = 'client' | 'coach' | 'admin';

interface AdminUserAnalyticsData {
  totalUsers: number;
  coachCount: number;
  adminCount: number;
  uniqueEnrolledUsers: number;
  roleData: RoleDistributionPoint[];
  signupTrendData: SignupTrendPoint[];
  engagementData: EngagementPoint[];
}

export function useAdminUserAnalytics() {
  return useQuery<AdminUserAnalyticsData>({
    queryKey: ['admin-user-analytics'],
    queryFn: async () => {
      const [
        { count: totalUsers },
        { data: roles },
        { count: activeWallets },
        { data: signups },
        { data: enrolledUsers },
        { count: completedUsers },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('user_roles').select('role'),
        supabase
          .from('credit_wallets')
          .select('*', { count: 'exact', head: true })
          .gt('balance', 0),
        supabase
          .from('profiles')
          .select('created_at')
          .gte('created_at', getSixMonthsAgoIso()),
        supabase.from('course_enrollments').select('user_id'),
        supabase
          .from('course_enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed'),
      ]);

      const roleDistribution: Record<SupportedRole, number> = {
        client: 0,
        coach: 0,
        admin: 0,
      };

      roles?.forEach((row: { role: string }) => {
        if (isSupportedRole(row.role)) {
          roleDistribution[row.role] += 1;
        }
      });

      const monthlySignups: Record<string, number> = {};
      signups?.forEach((row: { created_at: string }) => {
        const month = new Date(row.created_at).toLocaleString('default', {
          month: 'short',
          year: '2-digit',
        });
        monthlySignups[month] = (monthlySignups[month] || 0) + 1;
      });

      const roleData: RoleDistributionPoint[] = [
        {
          name: 'Clients',
          value: roleDistribution.client,
          color: 'hsl(var(--primary))',
        },
        {
          name: 'Coaches',
          value: roleDistribution.coach,
          color: 'hsl(var(--accent))',
        },
        {
          name: 'Admins',
          value: roleDistribution.admin,
          color: 'hsl(var(--muted-foreground))',
        },
      ].filter((item) => item.value > 0);

      const signupTrendData: SignupTrendPoint[] = Object.entries(monthlySignups).map(
        ([month, count]) => ({ month, signups: count }),
      );

      const uniqueEnrolledUsers = new Set(
        enrolledUsers?.map((row: { user_id: string }) => row.user_id),
      ).size;

      const engagementData: EngagementPoint[] = [
        { name: 'Enrolled', value: uniqueEnrolledUsers },
        { name: 'Completed', value: completedUsers || 0 },
        { name: 'With Balance', value: activeWallets || 0 },
      ];

      return {
        totalUsers: totalUsers || 0,
        coachCount: roleDistribution.coach,
        adminCount: roleDistribution.admin,
        uniqueEnrolledUsers,
        roleData,
        signupTrendData,
        engagementData,
      };
    },
  });
}

function getSixMonthsAgoIso() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  return sixMonthsAgo.toISOString();
}

function isSupportedRole(role: string): role is SupportedRole {
  return role === 'client' || role === 'coach' || role === 'admin';
}
