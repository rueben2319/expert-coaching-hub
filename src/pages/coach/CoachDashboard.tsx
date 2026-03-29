import { DashboardLayout } from "@/components/DashboardLayout";
import { coachSidebarSections } from "@/config/navigation";
import { CoachDashboardPage } from "@/features/coach-dashboard/CoachDashboardPage";
import { useAuth } from "@/hooks/useAuth";

export default function CoachDashboard() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <DashboardLayout sidebarSections={coachSidebarSections} brandName="Experts Coaching Hub">
      <CoachDashboardPage />
    </DashboardLayout>
  );
}
