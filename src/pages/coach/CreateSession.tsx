import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, addHours } from "date-fns";
import { Calendar, Clock, Users, Video, AlertCircle, CheckCircle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { coachSidebarSections } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { GoogleCalendarStatus } from "@/components/GoogleCalendarStatus";
import { MeetingManager } from "@/lib/meetingUtils";
import { AttendeeSelector } from "@/components/AttendeeSelector";

const meetingSchema = z.object({
  summary: z.string().min(3, "Title must be at least 3 characters").max(100),
  description: z.string().optional(),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  courseId: z.string().optional(),
}).refine(data => new Date(data.endTime) > new Date(data.startTime), {
  message: "End time must be after start time",
  path: ["endTime"],
});

type MeetingFormData = z.infer<typeof meetingSchema>;

const CreateSession = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [meetLink, setMeetLink] = useState<string | null>(null);
  const [isCalendarConnected, setIsCalendarConnected] = useState<boolean | null>(null);
  const [createdMeeting, setCreatedMeeting] = useState<any>(null);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [attendeeError, setAttendeeError] = useState<string>("");

  const { data: courses } = useQuery({
    queryKey: ["coach-courses"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("courses")
        .select("id, title")
        .eq("coach_id", user.id)
        .order("title");

      if (error) throw error;
      return data;
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<MeetingFormData>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      startTime: format(addHours(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
      endTime: format(addHours(new Date(), 2), "yyyy-MM-dd'T'HH:mm"),
    },
  });

  const startTime = watch("startTime");
  const courseId = watch("courseId");
  
  // Auto-update end time when start time changes
  useEffect(() => {
    if (startTime) {
      const start = new Date(startTime);
      const end = addHours(start, 1);
      setValue("endTime", format(end, "yyyy-MM-dd'T'HH:mm"));
    }
  }, [startTime, setValue]);

  const onSubmit = async (data: MeetingFormData) => {
    if (isCalendarConnected === false) {
      toast({
        title: "Google Calendar Required",
        description: "Please connect your Google Calendar to create meetings.",
        variant: "destructive",
      });
      return;
    }

    // Validate attendees
    if (selectedEmails.length === 0) {
      setAttendeeError("Please select at least one attendee");
      return;
    }
    setIsCreating(true);
    try {

      const meeting = await MeetingManager.createMeeting({
        summary: data.summary,
        description: data.description,
        startTime: new Date(data.startTime).toISOString(),
        endTime: new Date(data.endTime).toISOString(),
        attendeeEmails: selectedEmails,
        courseId: data.courseId || undefined,
      });

      setCreatedMeeting(meeting);
      setMeetLink(meeting.meet_link);
      
      toast({
        title: "Meeting Created Successfully",
        description: "Google Meet link has been generated and calendar invites sent to attendees.",
      });
    } catch (error: any) {
      console.error("Error creating meeting:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create meeting",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (meetLink && createdMeeting) {
    return (
      <DashboardLayout
        sidebarSections={coachSidebarSections}
        brandName="Experts Coaching Hub"
      >
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Meeting Created Successfully
              </CardTitle>
              <CardDescription>
                Your Google Meet session is ready and calendar invites have been sent to all attendees
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <Label className="text-sm font-medium">Meeting Details:</Label>
                  <div className="mt-2 space-y-2 text-sm">
                    <div><strong>Title:</strong> {createdMeeting.summary}</div>
                    <div><strong>Date:</strong> {format(new Date(createdMeeting.start_time), "PPP")}</div>
                    <div><strong>Time:</strong> {format(new Date(createdMeeting.start_time), "p")} - {format(new Date(createdMeeting.end_time), "p")}</div>
                    <div><strong>Attendees:</strong> {Array.isArray(createdMeeting.attendees) ? createdMeeting.attendees.length : 0} people</div>
                  </div>
                </div>
                
                <div className="p-4 bg-muted rounded-lg">
                  <Label className="text-sm font-medium">Google Meet Link:</Label>
                  <div className="mt-2 flex gap-2">
                    <Input value={meetLink} readOnly className="font-mono text-xs" />
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(meetLink);
                        toast({ title: "Link copied to clipboard" });
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button
                  onClick={() => window.open(meetLink, "_blank")}
                  className="flex-1"
                >
                  <Video className="mr-2 h-4 w-4" />
                  Join Meeting Now
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/coach/sessions")}
                  className="flex-1"
                >
                  View All Sessions
                </Button>
              </div>
              
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Calendar invites have been automatically sent to all attendees. They will receive an email with the meeting details and Google Meet link.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      sidebarSections={coachSidebarSections}
      brandName="Experts Coaching Hub"
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Schedule New Session</h1>
          <p className="text-muted-foreground mt-2">
            Create a Google Meet session and send calendar invites to participants
          </p>
        </div>

        <GoogleCalendarStatus 
          onStatusChange={setIsCalendarConnected}
        />

        {isCalendarConnected === false && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Google Calendar connection is required to create meetings. Please connect your account above.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Session Details</CardTitle>
            <CardDescription>
              Fill in the details below to create a new meeting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="summary">Meeting Title *</Label>
                <Input
                  id="summary"
                  placeholder="e.g., Weekly Coaching Session"
                  {...register("summary")}
                />
                {errors.summary && (
                  <p className="text-sm text-destructive">{errors.summary.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Optional meeting description..."
                  rows={3}
                  {...register("description")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="courseId">Related Course (Optional)</Label>
                <select
                  id="courseId"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("courseId")}
                >
                  <option value="">No course selected</option>
                  {courses?.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Start Time *
                  </Label>
                  <Input
                    id="startTime"
                    type="datetime-local"
                    {...register("startTime")}
                  />
                  {errors.startTime && (
                    <p className="text-sm text-destructive">{errors.startTime.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endTime" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    End Time *
                  </Label>
                  <Input
                    id="endTime"
                    type="datetime-local"
                    {...register("endTime")}
                  />
                  {errors.endTime && (
                    <p className="text-sm text-destructive">{errors.endTime.message}</p>
                  )}
                </div>
              </div>

              <AttendeeSelector
                courseId={courseId}
                selectedEmails={selectedEmails}
                onEmailsChange={setSelectedEmails}
                error={attendeeError}
              />

              <div className="flex gap-3">
                <Button 
                  type="submit" 
                  disabled={isCreating || isCalendarConnected === false} 
                  className="flex-1"
                >
                  {isCreating ? "Creating Meeting..." : "Create Meeting"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/coach/sessions")}
                >
                  Cancel
                </Button>
              </div>
              
              {isCalendarConnected === false && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Connect your Google Calendar to enable meeting creation.
                  </AlertDescription>
                </Alert>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CreateSession;
