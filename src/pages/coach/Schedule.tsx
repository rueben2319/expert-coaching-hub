import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/DashboardLayout";
import { GoogleCalendarView } from "@/components/GoogleCalendarView";
import { GoogleCalendarStatus } from "@/components/GoogleCalendarStatus";
import { Plus } from "lucide-react";
import { useState } from "react";
import { coachSidebarSections } from "@/config/navigation";
import { useNavigate } from "react-router-dom";

const Schedule = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isCalendarConnected, setIsCalendarConnected] = useState<boolean | null>(null);

  return (
    <DashboardLayout
      sidebarSections={coachSidebarSections}
      brandName="Experts Coaching Hub"
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Schedule</h1>
            <p className="text-muted-foreground">Manage your coaching schedule and appointments</p>
          </div>
          <Button onClick={() => navigate("/coach/sessions/create")}>
            <Plus className="w-4 h-4 mr-2" />
            Schedule New Session
          </Button>
        </div>

        <GoogleCalendarStatus 
          compact={true}
          onStatusChange={setIsCalendarConnected}
        />

        <GoogleCalendarView 
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          showNavigation={true}
        />
      </div>
    </DashboardLayout>
  );
};

export default Schedule;