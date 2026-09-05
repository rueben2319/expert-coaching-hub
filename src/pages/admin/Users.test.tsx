import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AdminUsers from './Users';

vi.mock('@/components/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/hooks/useAdminUserAnalytics', () => ({
  useAdminUserAnalytics: () => ({
    data: {
      totalUsers: 1450,
      coachCount: 130,
      adminCount: 18,
      uniqueEnrolledUsers: 720,
      roleData: [
        { name: 'Clients', value: 1302, color: 'hsl(var(--primary))' },
        { name: 'Coaches', value: 130, color: 'hsl(var(--accent))' },
        { name: 'Admins', value: 18, color: 'hsl(var(--muted-foreground))' },
      ],
      signupTrendData: [
        { month: 'Jan', signups: 50 },
        { month: 'Feb', signups: 90 },
      ],
      engagementData: [
        { name: 'Enrolled', value: 720 },
        { name: 'Completed', value: 310 },
        { name: 'With Balance', value: 480 },
      ],
    },
    isLoading: false,
  }),
}));

describe('AdminUsers', () => {
  it('renders the key user metrics and audience mix overview', () => {
    render(<AdminUsers />);

    expect(screen.getByText('Key platform metrics')).toBeInTheDocument();
    expect(screen.getByText('Audience mix')).toBeInTheDocument();
    expect(screen.getByText('Engagement overview')).toBeInTheDocument();
  });
});
