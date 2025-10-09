import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { CourseOverview } from "@/components/course/CourseOverview";
import { CourseCurriculum } from "@/components/course/CourseCurriculum";
import { Eye, Save, Plus, BookOpen, Users, BarChart3, Calendar, Video } from "lucide-react";

export default function EditCourse() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: course, isLoading } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  const publishMutation = useMutation({
    mutationFn: async (status: "draft" | "published") => {
      const { error } = await supabase
        .from("courses")
        .update({ status })
        .eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course", courseId] });
      toast({ title: "Course status updated" });
    },
  });

  const navItems = [
    { label: "Dashboard", href: "/coach" },
    { label: "Courses", href: "/coach/courses" },
    { label: "Students", href: "/coach/students" },
    { label: "Analytics", href: "/coach/analytics" },
  ];

  const sidebarSections = [
    {
      title: "Course Management",
      items: [
        { icon: <Plus className="h-4 w-4" />, label: "Create Course", href: "/coach/courses/create" },
        { icon: <BookOpen className="h-4 w-4" />, label: "My Courses", href: "/coach/courses" },
        { icon: <Video className="h-4 w-4" />, label: "Live Sessions", href: "/coach/sessions" },
      ],
    },
    {
      title: "Students",
      items: [
        { icon: <Users className="h-4 w-4" />, label: "All Students", href: "/coach/students" },
        { icon: <Calendar className="h-4 w-4" />, label: "Schedule", href: "/coach/schedule" },
        { icon: <BarChart3 className="h-4 w-4" />, label: "Analytics", href: "/coach/analytics" },
      ],
    },
  ];

  if (isLoading) {
    return (
      <DashboardLayout navItems={navItems} sidebarSections={sidebarSections}>
        <div className="text-center py-12">Loading course...</div>
      </DashboardLayout>
    );
  }

  if (!course) {
    return (
      <DashboardLayout navItems={navItems} sidebarSections={sidebarSections}>
        <div className="text-center py-12">Course not found</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navItems={navItems} sidebarSections={sidebarSections}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{course.title}</h1>
            <Badge variant={course.status === "published" ? "default" : "secondary"}>
              {course.status}
            </Badge>
          </div>
          <div className="flex gap-2">
            {course.status === "draft" ? (
              <Button onClick={() => publishMutation.mutate("published")}>
                <Eye className="mr-2 h-4 w-4" />
                Publish
              </Button>
            ) : (
              <Button variant="outline" onClick={() => publishMutation.mutate("draft")}>
                Unpublish
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <CourseOverview course={course} />
          </TabsContent>

          <TabsContent value="curriculum">
            <CourseCurriculum courseId={course.id} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
