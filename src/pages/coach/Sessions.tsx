import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, Video, Plus, ExternalLink, Copy, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { coachNavItems, coachSidebarSections } from "@/config/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Sessions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("upcoming");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null);

  const { data: meetings, isLoading } = useQuery({
    queryKey: ["coach-meetings"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("meetings" as any)
        .select(`
          *,
          courses(title)
        `)
        .eq("user_id", user.id)
        .order("start_time", { ascending: false });

      if (error) throw error;
      return data as any[];
    },
  });

  const handleCancelMeeting = async (meetingId: string) => {
    try {
      const { error } = await supabase.functions.invoke("cancel-google-meet", {
        body: { meetingId },
      });

      if (error) throw error;

      toast({ title: "Meeting cancelled successfully" });
      queryClient.invalidateQueries({ queryKey: ["coach-meetings"] });
      setDeleteDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel meeting",
        variant: "destructive",
      });
    }
  };

  const copyMeetLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({ title: "Meet link copied to clipboard" });
  };

  const trackJoinClick = async (meetingId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("meeting_analytics" as any).insert({
      meeting_id: meetingId,
      user_id: user.id,
      event_type: "join_clicked",
    });
  };

  const filteredMeetings = meetings?.filter(meeting => {
    const now = new Date();
    const meetingStart = new Date(meeting.start_time);
    
    if (filter === "all") return true;
    if (filter === "upcoming") return meetingStart > now && meeting.status !== "cancelled";
    return meetingStart < now || meeting.status === "cancelled";
  }) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled": return "default";
      case "cancelled": return "destructive";
      case "completed": return "secondary";
      default: return "default";
    }
  };

  return (
    <DashboardLayout
      navItems={coachNavItems}
      sidebarSections={coachSidebarSections}
      brandName="Experts Coaching Hub"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Sessions</h1>
            <p className="text-muted-foreground mt-2">Manage your Google Meet sessions</p>
          </div>
          <Button onClick={() => navigate("/coach/sessions/create")}>
            <Plus className="mr-2 h-4 w-4" />
            Schedule New Session
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter === "upcoming" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("upcoming")}
          >
            Upcoming
          </Button>
          <Button
            variant={filter === "past" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("past")}
          >
            Past
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading sessions...</div>
        ) : filteredMeetings.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No sessions found</h3>
              <p className="text-muted-foreground mb-4">
                {filter === "upcoming"
                  ? "Schedule your first session to get started"
                  : "No sessions match your filter"}
              </p>
              <Button onClick={() => navigate("/coach/sessions/create")}>
                <Plus className="mr-2 h-4 w-4" />
                Schedule Session
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredMeetings.map((meeting) => (
              <Card key={meeting.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold">{meeting.summary}</h3>
                        <Badge variant={getStatusColor(meeting.status)}>
                          {meeting.status}
                        </Badge>
                      </div>

                      {meeting.description && (
                        <p className="text-sm text-muted-foreground">{meeting.description}</p>
                      )}

                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(meeting.start_time), "MMM d, yyyy")}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {format(new Date(meeting.start_time), "h:mm a")} -{" "}
                          {format(new Date(meeting.end_time), "h:mm a")}
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {Array.isArray(meeting.attendees) ? meeting.attendees.length : 0} attendees
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      {meeting.meet_link && meeting.status === "scheduled" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => {
                              trackJoinClick(meeting.id);
                              window.open(meeting.meet_link!, "_blank");
                            }}
                          >
                            <Video className="mr-2 h-4 w-4" />
                            Join
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyMeetLink(meeting.meet_link!)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {meeting.status !== "cancelled" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedMeeting(meeting.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Meeting?</AlertDialogTitle>
              <AlertDialogDescription>
                This will cancel the Google Calendar event and notify all attendees.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Meeting</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedMeeting && handleCancelMeeting(selectedMeeting)}
              >
                Cancel Meeting
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
