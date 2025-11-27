import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Calendar, Clock, Users, Video, ArrowLeft, MessageCircle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { clientSidebarSections } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

interface Meeting {
  id: string;
  summary: string;
  description?: string;
  start_time: string;
  end_time: string;
  attendees: string[];
  status: string;
  meet_link?: string;
  calendar_event_id?: string;
  user_id: string;
}

const SessionDetails = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isJoining, setIsJoining] = useState(false);

  const { data: meeting, isLoading } = useQuery({
    queryKey: ["client-meeting-details", meetingId],
    queryFn: async () => {
      if (!meetingId) throw new Error("Meeting ID is required");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("id", meetingId)
        .single();

      if (error) throw error;
      if (!data) throw new Error("Meeting not found");

      // Verify user is an attendee
      const attendees = Array.isArray(data.attendees) ? data.attendees : [];
      if (!attendees.includes(user.email)) {
        throw new Error("Access denied: You are not an attendee of this meeting");
      }

      return data as Meeting;
    },
    enabled: !!meetingId,
  });

  const { data: acceptedMeetings } = useQuery({
    queryKey: ["client-meeting-acceptances", meetingId],
    queryFn: async () => {
      if (!meetingId) return {};

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {};

      const { data, error } = await supabase
        .from("meeting_analytics")
        .select("meeting_id, event_type")
        .eq("user_id", user.id)
        .eq("meeting_id", meetingId)
        .eq("event_type", "invitation_accepted");

      if (error) {
        console.error("Error fetching acceptance status:", error);
        return {};
      }

      return { [meetingId]: data.length > 0 };
    },
    enabled: !!meetingId,
  });

  const getMeetingStatus = (meeting: Meeting) => {
    const now = new Date();
    const startTime = new Date(meeting.start_time);
    const endTime = new Date(meeting.end_time);

    if (meeting.status === "cancelled") {
      return { label: "Cancelled", color: "destructive" };
    } else if (now < startTime) {
      return { label: "Scheduled", color: "default" };
    } else if (now >= startTime && now <= endTime) {
      return { label: "In Progress", color: "default" };
    } else {
      return { label: "Completed", color: "secondary" };
    }
  };

  const canJoinMeeting = (meeting: Meeting) => {
    const now = new Date();
    const startTime = new Date(meeting.start_time);
    const fifteenMinutesBefore = new Date(startTime.getTime() - 15 * 60 * 1000);
    const endTime = new Date(meeting.end_time);

    return now >= fifteenMinutesBefore && now <= endTime && meeting.status !== "cancelled";
  };

  const acceptInvitation = async () => {
    if (!meeting) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("meeting_analytics").insert({
        meeting_id: meeting.id,
        user_id: user.id,
        event_type: "invitation_accepted",
        event_data: {
          timestamp: new Date().toISOString(),
          user_role: "client",
        },
      });

      toast({
        title: "Invitation Accepted",
        description: "You have accepted the meeting invitation.",
      });

      // Refresh acceptance status
      window.location.reload();
    } catch (error) {
      console.error("Error accepting invitation:", error);
      toast({
        title: "Error",
        description: "Failed to accept invitation.",
        variant: "destructive",
      });
    }
  };

  const joinMeeting = async () => {
    if (!meeting?.meet_link) return;

    setIsJoining(true);
    window.open(meeting.meet_link, "_blank");
    
    // Get user data first
    const { data: { user } } = await supabase.auth.getUser();
    
    // Log join click
    await supabase.from("meeting_analytics").insert({
      meeting_id: meeting.id,
      user_id: user?.id,
      event_type: "join_clicked",
      event_data: {
        timestamp: new Date().toISOString(),
        user_role: "client",
      },
    });

    setTimeout(() => setIsJoining(false), 2000);
  };

  if (isLoading) {
    return (
      <DashboardLayout sidebarSections={clientSidebarSections} brandName="Experts Coaching Hub">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading meeting details...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!meeting) {
    return (
      <DashboardLayout sidebarSections={clientSidebarSections} brandName="Experts Coaching Hub">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Meeting not found</div>
        </div>
      </DashboardLayout>
    );
  }

  const statusInfo = getMeetingStatus(meeting);
  const canJoin = canJoinMeeting(meeting);
  const isAccepted = acceptedMeetings?.[meeting.id];

  return (
    <DashboardLayout sidebarSections={clientSidebarSections} brandName="Experts Coaching Hub">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/client/sessions")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sessions
          </Button>
          <h1 className="text-2xl font-bold">{meeting.summary}</h1>
          <Badge variant={statusInfo.color as any}>
            {statusInfo.label}
          </Badge>
        </div>

        {/* Meeting Details */}
        <Card>
          <CardHeader>
            <CardTitle>Meeting Details</CardTitle>
            <CardDescription>
              {meeting.description || "No description provided"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Date & Time */}
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">
                    {format(new Date(meeting.start_time), "EEEE, MMMM d, yyyy")}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(meeting.start_time), "h:mm a")} - {format(new Date(meeting.end_time), "h:mm a")}
                  </div>
                </div>
              </div>

              {/* Duration */}
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">Duration</div>
                  <div className="text-sm text-muted-foreground">
                    {Math.round((new Date(meeting.end_time).getTime() - new Date(meeting.start_time).getTime()) / (1000 * 60))} minutes
                  </div>
                </div>
              </div>

              {/* Attendees */}
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">Attendees</div>
                  <div className="text-sm text-muted-foreground">
                    {Array.isArray(meeting.attendees) ? meeting.attendees.length : 0} people
                  </div>
                </div>
              </div>

              {/* Meeting Link */}
              {meeting.meet_link && (
                <div className="flex items-center gap-3">
                  <Video className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Google Meet Link</div>
                    <div className="text-sm text-muted-foreground">
                      Available 15 minutes before start time
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t">
              {/* Accept Invitation */}
              {!isAccepted && (
                <Button onClick={acceptInvitation} className="gap-2 bg-green-600 hover:bg-green-700">
                  <Calendar className="h-4 w-4" />
                  Accept Invitation
                </Button>
              )}

              {/* Show Accepted Badge */}
              {isAccepted && (
                <div className="flex items-center gap-2 text-green-600">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm font-medium">Invitation Accepted</span>
                </div>
              )}

              {/* Join Meeting */}
              {meeting.meet_link && canJoin && (
                <Button onClick={joinMeeting} disabled={isJoining} className="gap-2">
                  <Video className="h-4 w-4" />
                  {isJoining ? "Opening..." : "Join Meeting"}
                  <Video className="h-4 w-4" />
                </Button>
              )}

              {!canJoin && meeting.meet_link && (
                <p className="text-sm text-muted-foreground ml-auto">
                  Join available 15 minutes before start time
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Attendees List */}
        {Array.isArray(meeting.attendees) && meeting.attendees.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Attendees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {meeting.attendees.map((email, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    {email}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SessionDetails;
