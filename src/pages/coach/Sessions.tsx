import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, Video, Plus, ExternalLink, Copy, Trash2, Edit, RefreshCw, AlertCircle, Save, X, Eye } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, isAfter, isBefore, addMinutes } from "date-fns";
import { coachNavItems, coachSidebarSections } from "@/config/navigation";
import { GoogleCalendarStatus } from "@/components/GoogleCalendarStatus";
import { MeetingManager } from "@/lib/meetingUtils";
import { TokenDebugger, addTokenDebugToWindow } from "@/lib/tokenDebug";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function Sessions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "upcoming" | "past" | "today">("upcoming");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null);
  const [isCalendarConnected, setIsCalendarConnected] = useState<boolean | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    summary: "",
    description: "",
    startTime: "",
    endTime: "",
  });

  const { data: meetings, isLoading, refetch } = useQuery({
    queryKey: ["coach-meetings"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("meetings")
        .select(`
          *,
          courses(title)
        `)
        .eq("user_id", user.id)
        .order("start_time", { ascending: false });

      if (error) throw error;
      return data;
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refresh every minute for real-time updates
  });

  const handleCancelMeeting = async (meetingId: string) => {
    try {
      await MeetingManager.cancelMeeting(meetingId);
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

  const handleRefreshMeetings = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({ title: "Meetings refreshed" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh meetings",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const copyMeetLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({ title: "Meet link copied to clipboard" });
  };

  const trackJoinClick = async (meetingId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await MeetingManager.logAnalyticsEvent(meetingId, user.id, "join_clicked", {
      timestamp: new Date().toISOString(),
      source: "sessions_page",
    });
  };

  const startEditMeeting = (meeting: any) => {
    setEditingMeeting(meeting.id);
    setEditForm({
      summary: meeting.summary || "",
      description: meeting.description || "",
      startTime: format(new Date(meeting.start_time), "yyyy-MM-dd'T'HH:mm"),
      endTime: format(new Date(meeting.end_time), "yyyy-MM-dd'T'HH:mm"),
    });
  };

  const cancelEdit = () => {
    setEditingMeeting(null);
    setEditForm({
      summary: "",
      description: "",
      startTime: "",
      endTime: "",
    });
  };

  const saveEdit = async () => {
    if (!editingMeeting) return;

    // Client-side validation for date fields
    const startDate = new Date(editForm.startTime);
    const endDate = new Date(editForm.endTime);

    // Validate start time
    if (isNaN(startDate.getTime())) {
      toast({
        title: "Invalid Start Time",
        description: "Please enter a valid start date and time",
        variant: "destructive",
      });
      return;
    }

    // Validate end time
    if (isNaN(endDate.getTime())) {
      toast({
        title: "Invalid End Time",
        description: "Please enter a valid end date and time",
        variant: "destructive",
      });
      return;
    }

    // Validate that start time is before end time
    if (startDate >= endDate) {
      toast({
        title: "Invalid Time Range",
        description: "Start time must be before end time",
        variant: "destructive",
      });
      return;
    }

    try {
      await MeetingManager.updateMeeting(editingMeeting, {
        summary: editForm.summary,
        description: editForm.description,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
      });

      toast({
        title: "Meeting Updated",
        description: "Meeting has been updated successfully",
      });

      queryClient.invalidateQueries({ queryKey: ["coach-meetings"] });
      cancelEdit();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update meeting",
        variant: "destructive",
      });
    }
  };

  const filteredMeetings = meetings?.filter(meeting => {
    const now = new Date();
    const meetingStart = new Date(meeting.start_time);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (filter === "all") return true;
    if (filter === "upcoming") return meetingStart > now && meeting.status !== "cancelled";
    if (filter === "today") {
      return meetingStart >= today && meetingStart < tomorrow && meeting.status !== "cancelled";
    }
    return meetingStart < now || meeting.status === "cancelled";
  }) || [];

  const getMeetingStatus = (meeting: any) => {
    const now = new Date();
    const startTime = new Date(meeting.start_time);
    const endTime = new Date(meeting.end_time);
    
    if (meeting.status === "cancelled") return "cancelled";
    if (now >= startTime && now <= endTime) return "in_progress";
    if (now > endTime) return "completed";
    if (isAfter(startTime, addMinutes(now, -15)) && isBefore(startTime, addMinutes(now, 15))) return "starting_soon";
    return "scheduled";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled": return "default";
      case "cancelled": return "destructive";
      case "completed": return "secondary";
      case "in_progress": return "default";
      case "starting_soon": return "outline";
      default: return "default";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "scheduled": return "Scheduled";
      case "cancelled": return "Cancelled";
      case "completed": return "Completed";
      case "in_progress": return "Live";
      case "starting_soon": return "Starting Soon";
      default: return status;
    }
  };

  return (
    <DashboardLayout
      navItems={coachNavItems}
      sidebarSections={coachSidebarSections}
      brandName="Experts Coaching Hub"
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-center sm:text-left">
            <h1 className="text-3xl font-bold">Sessions</h1>
            <p className="text-muted-foreground mt-2">Manage your Google Meet sessions</p>
          </div>
          <Button onClick={() => navigate("/coach/sessions/create")} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Schedule New Session
          </Button>
        </div>

        <div className="space-y-4">
          <GoogleCalendarStatus 
            compact={true}
            onStatusChange={setIsCalendarConnected}
          />
          
          {/* Debug Section - Remove in production */}
          {/* 
          <Card className="border-dashed border-orange-200 bg-orange-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-orange-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Token Debug Tools (Development)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    TokenDebugger.logTokenStatus();
                    addTokenDebugToWindow();
                  }}
                  className="text-xs"
                >
                  Log Token Status
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const info = await TokenDebugger.getTokenInfo();
                    toast({
                      title: "Token Info",
                      description: `Session: ${info.hasSession ? '✅' : '❌'} | Provider Token: ${info.hasProviderToken ? '✅' : '❌'} | Refresh Token: ${info.hasRefreshToken ? '✅' : '❌'}`,
                    });
                  }}
                  className="text-xs"
                >
                  Show Token Status
                </Button>
              </div>
              <p className="text-xs text-orange-600 mt-2">
                Check browser console for detailed token information. Use <code>window.tokenDebug</code> for manual testing.
              </p>
            </CardContent>
          </Card>
          */}
          
          {isCalendarConnected === false && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Google Calendar is not connected. Some features may be limited.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
              >
                All
              </Button>
              <Button
                variant={filter === "today" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("today")}
              >
                Today
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshMeetings}
              disabled={isRefreshing}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
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
                  {editingMeeting === meeting.id ? (
                    <div className="space-y-4 sm:space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="edit-summary">Meeting Title</Label>
                        <Input
                          id="edit-summary"
                          value={editForm.summary}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, summary: e.target.value }))}
                          placeholder="Meeting title"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-description">Description</Label>
                        <Textarea
                          id="edit-description"
                          value={editForm.description}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                          placeholder="Meeting description (optional)"
                          rows={2}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="edit-start">Start Time</Label>
                          <Input
                            id="edit-start"
                            type="datetime-local"
                            value={editForm.startTime}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, startTime: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-end">End Time</Label>
                          <Input
                            id="edit-end"
                            type="datetime-local"
                            value={editForm.endTime}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, endTime: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button size="sm" onClick={saveEdit} className="w-full sm:w-auto">
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit} className="w-full sm:w-auto">
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                          <h3 className="text-lg font-semibold">{meeting.summary}</h3>
                          <Badge variant={getStatusColor(getMeetingStatus(meeting))}>
                            {getStatusLabel(getMeetingStatus(meeting))}
                          </Badge>
                          {meeting.courses?.title && (
                            <Badge variant="secondary">{meeting.courses.title}</Badge>
                          )}
                        </div>

                        {meeting.description && (
                          <p className="text-sm text-muted-foreground">{meeting.description}</p>
                        )}

                        <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-4">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(meeting.start_time), "MMM d, yyyy")}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {format(new Date(meeting.start_time), "h:mm a")} - {format(new Date(meeting.end_time), "h:mm a")}
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {Array.isArray(meeting.attendees) ? meeting.attendees.length : 0} attendees
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 w-full sm:flex-row sm:w-auto lg:ml-4">
                        {meeting.meet_link && ["scheduled", "in_progress", "starting_soon"].includes(getMeetingStatus(meeting)) && (
                          <Button
                            size="sm"
                            variant={getMeetingStatus(meeting) === "in_progress" ? "default" : "outline"}
                            onClick={() => {
                              trackJoinClick(meeting.id);
                              window.open(meeting.meet_link!, "_blank");
                            }}
                            className="w-full sm:w-auto"
                          >
                            <Video className="mr-2 h-4 w-4" />
                            {getMeetingStatus(meeting) === "in_progress" ? "Join Now" : "Join"}
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/coach/sessions/${meeting.id}`)}
                          className="w-full sm:w-auto"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {["scheduled", "starting_soon"].includes(getMeetingStatus(meeting)) && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditMeeting(meeting)}
                              className="w-full sm:w-auto"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedMeeting(meeting.id);
                                setDeleteDialogOpen(true);
                              }}
                              className="w-full sm:w-auto"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
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
