import { useParams, useNavigate } from "react-router-dom";
import { coachSidebarSections } from "@/config/navigation";
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
import { ContentQualityDashboard } from "@/components/coach/ContentQualityDashboard";
import { Eye, Sparkles } from "lucide-react";

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
        .select(`
          *,
          course_modules(
            lessons(
              estimated_duration
            )
          )
        `)
        .eq("id", courseId)
        .single();

      if (error) throw error;
      
      // Calculate total duration
      let totalMinutes = 0;
      if (data.course_modules) {
        data.course_modules.forEach((module: any) => {
          if (module.lessons) {
            module.lessons.forEach((lesson: any) => {
              totalMinutes += lesson.estimated_duration || 0;
            });
          }
        });
      }
      
      return {
        ...data,
        total_duration: totalMinutes
      };
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

  if (isLoading) {
    return (
      <DashboardLayout sidebarSections={coachSidebarSections}>
        <div className="text-center py-12">Loading course...</div>
      </DashboardLayout>
    );
  }

  if (!course) {
    return (
      <DashboardLayout sidebarSections={coachSidebarSections}>
        <div className="text-center py-12">Course not found</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout sidebarSections={coachSidebarSections}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold truncate">{course.title}</h1>
            <Badge variant={course.status === "published" ? "default" : "secondary"} className="flex-shrink-0">
              {course.status}
            </Badge>
          </div>
          <div className="flex gap-2 flex-shrink-0">
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
            <TabsTrigger value="quality" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Quality
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <CourseOverview course={course} />
          </TabsContent>

          <TabsContent value="curriculum">
            <CourseCurriculum courseId={course.id} />
          </TabsContent>

          <TabsContent value="quality">
            <ContentQualityDashboard courseId={course.id} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
