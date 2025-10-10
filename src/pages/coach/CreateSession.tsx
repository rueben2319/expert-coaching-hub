import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar, Clock, Users, Video } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { coachNavItems, coachSidebarSections } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const meetingSchema = z.object({
  summary: z.string().min(3, "Title must be at least 3 characters").max(100),
  description: z.string().optional(),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  attendees: z.string().min(1, "At least one attendee is required"),
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
  } = useForm<MeetingFormData>({
    resolver: zodResolver(meetingSchema),
  });

  const onSubmit = async (data: MeetingFormData) => {
    setIsCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const attendeeEmails = data.attendees
        .split(",")
        .map(email => email.trim())
        .filter(email => email);

      const { data: result, error } = await supabase.functions.invoke("create-google-meet", {
        body: {
          summary: data.summary,
          description: data.description,
          startTime: new Date(data.startTime).toISOString(),
          endTime: new Date(data.endTime).toISOString(),
          attendees: attendeeEmails,
          courseId: data.courseId || null,
        },
      });

      if (error) throw error;

      setMeetLink(result.meeting.meetLink);
      
      toast({
        title: "Meeting Created",
        description: "Google Meet link has been generated and invites sent to attendees.",
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

  if (meetLink) {
    return (
      <DashboardLayout
        navItems={coachNavItems}
        sidebarSections={coachSidebarSections}
      >
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Meeting Created Successfully
              </CardTitle>
              <CardDescription>
                Your Google Meet link is ready and calendar invites have been sent
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <Label className="text-sm font-medium">Meet Link:</Label>
                <div className="mt-2 flex gap-2">
                  <Input value={meetLink} readOnly />
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
              <div className="flex gap-3">
                <Button
                  onClick={() => window.open(meetLink, "_blank")}
                  className="flex-1"
                >
                  <Video className="mr-2 h-4 w-4" />
                  Join Meeting
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/coach/sessions")}
                  className="flex-1"
                >
                  View All Sessions
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      navItems={coachNavItems}
      sidebarSections={coachSidebarSections}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Schedule New Session</h1>
          <p className="text-muted-foreground mt-2">
            Create a Google Meet session and send calendar invites to participants
          </p>
        </div>

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

              <div className="space-y-2">
                <Label htmlFor="attendees" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Attendees (comma-separated emails) *
                </Label>
                <Input
                  id="attendees"
                  placeholder="user1@example.com, user2@example.com"
                  {...register("attendees")}
                />
                {errors.attendees && (
                  <p className="text-sm text-destructive">{errors.attendees.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Calendar invites will be sent automatically
                </p>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={isCreating} className="flex-1">
                  {isCreating ? "Creating..." : "Create Meeting"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/coach/sessions")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CreateSession;
