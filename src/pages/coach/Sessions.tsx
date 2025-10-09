import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { BookOpen, Plus, Users, BarChart3, Calendar, Video, Clock, MapPin } from "lucide-react";
import { coachNavItems, coachSidebarSections } from "@/config/navigation";
import { useNavigate } from "react-router-dom";

export default function Sessions() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Mock sessions data
  const sessions = [
    {
      id: 1,
      title: "JavaScript Fundamentals Q&A",
      course: "Complete JavaScript Course",
      date: "2024-01-15",
      time: "14:00",
      duration: "60 min",
      attendees: 12,
      status: "upcoming",
      meetingLink: "https://zoom.us/j/123456789"
    },
    {
      id: 2,
      title: "React Hooks Deep Dive",
      course: "React Masterclass",
      date: "2024-01-12",
      time: "16:00",
      duration: "90 min",
      attendees: 8,
      status: "completed",
      meetingLink: "https://zoom.us/j/987654321"
    },
    {
      id: 3,
      title: "Portfolio Review Session",
      course: "Web Development Bootcamp",
      date: "2024-01-18",
      time: "10:00",
      duration: "120 min",
      attendees: 15,
      status: "upcoming",
      meetingLink: "https://zoom.us/j/456789123"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "upcoming": return "bg-blue-100 text-blue-800";
      case "completed": return "bg-green-100 text-green-800";
      case "cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <DashboardLayout
      navItems={coachNavItems}
      sidebarSections={coachSidebarSections}
      brandName="Experts Coaching Hub"
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Live Sessions</h1>
            <p className="text-muted-foreground">Manage your live coaching sessions</p>
          </div>
          <Button onClick={() => navigate("/coach/sessions/create")}>
            <Plus className="w-4 h-4 mr-2" />
            Schedule Session
          </Button>
        </div>

        <div className="grid gap-4">
          {sessions.map((session) => (
            <div key={session.id} className="bg-muted/30 rounded-lg p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{session.title}</h3>
                    <Badge className={getStatusColor(session.status)}>
                      {session.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{session.course}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {session.date}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {session.time} ({session.duration})
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {session.attendees} attendees
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {session.status === "upcoming" && (
                    <>
                      <Button variant="outline" size="sm">
                        <MapPin className="h-4 w-4 mr-2" />
                        Join Meeting
                      </Button>
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </>
                  )}
                  {session.status === "completed" && (
                    <Button variant="outline" size="sm">
                      View Recording
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {sessions.length === 0 && (
          <div className="text-center py-12">
            <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No sessions scheduled</h3>
            <p className="text-muted-foreground mb-4">
              Schedule your first live session to connect with your students
            </p>
            <Button onClick={() => navigate("/coach/sessions/create")}>
              <Plus className="w-4 h-4 mr-2" />
              Schedule First Session
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
