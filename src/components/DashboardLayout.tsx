import { DashboardShell, DashboardShellProps } from "@/features/dashboard-shell/DashboardShell";

export type DashboardLayoutProps = DashboardShellProps;

export function DashboardLayout(props: DashboardLayoutProps) {
  return <DashboardShell {...props} />;
}
