import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Plus, Calendar } from "lucide-react";
import { useState } from "react";
import { coachSidebarSections } from "@/config/navigation";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { MeetingManager } from "@/lib/meetingUtils";
import { format, startOfWeek, endOfWeek, addDays, isToday, isSameDay } from "date-fns";

const Schedule = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["schedule-meetings", weekStart.toISOString(), weekEnd.toISOString()],
    queryFn: () => MeetingManager.getUserMeetings({
      startDate: weekStart.toISOString(),
      endDate: weekEnd.toISOString(),
    }),
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <DashboardLayout sidebarSections={coachSidebarSections} brandName="Experts Coaching Hub">
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

        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(d => addDays(d, -7))}>
            Previous Week
          </Button>
          <span className="text-sm font-medium">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
          </span>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(d => addDays(d, 7))}>
            Next Week
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dayMeetings = meetings.filter(m => isSameDay(new Date(m.start_time), day));
            return (
              <Card key={day.toISOString()} className={isToday(day) ? "border-primary" : ""}>
                <CardHeader className="p-2">
                  <CardTitle className="text-xs text-center">
                    <div>{format(day, "EEE")}</div>
                    <div className={isToday(day) ? "text-primary font-bold" : ""}>{format(day, "d")}</div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-1 space-y-1">
                  {dayMeetings.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => navigate(`/coach/sessions/${m.id}`)}
                      className="w-full text-left p-1 rounded bg-primary/10 hover:bg-primary/20 transition-colors"
                    >
                      <p className="text-xs font-medium truncate">{m.summary}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(m.start_time), "HH:mm")}</p>
                    </button>
                  ))}
                  {isLoading && <div className="text-xs text-muted-foreground text-center">...</div>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Schedule;
