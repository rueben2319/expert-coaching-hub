import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { CourseTemplateLayout } from "@/components/CourseTemplateLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContentRenderer } from "@/components/content/ContentRenderer";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, Clock, BookOpen, PlayCircle } from "lucide-react";

type ViewType = "overview" | "lesson";

export default function CourseViewer() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentView, setCurrentView] = useState<ViewType>("overview");
  const [currentModuleId, setCurrentModuleId] = useState<string | undefined>();
  const [currentLessonId, setCurrentLessonId] = useState<string | undefined>();

  // Fetch course details
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ["course-detail", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          *,
          course_modules(
            *,
            lessons(*)
          )
        `)
        .eq("id", courseId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  // Fetch enrollment
  const { data: enrollment } = useQuery({
    queryKey: ["enrollment", courseId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_enrollments")
        .select("*")
        .eq("course_id", courseId)
        .eq("user_id", user!.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!courseId && !!user?.id,
  });

  // Fetch lesson progress
  const { data: lessonProgress } = useQuery({
    queryKey: ["lesson-progress", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_progress")
        .select("*")
        .eq("user_id", user!.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch current lesson details
  const { data: currentLesson } = useQuery({
    queryKey: ["lesson-detail", currentLessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select(`
          *,
          lesson_content(*)
        `)
        .eq("id", currentLessonId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!currentLessonId && currentView === "lesson",
  });

  // Mark lesson as complete
  const completeLessonMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      const { error } = await supabase
        .from("lesson_progress")
        .upsert({
          user_id: user!.id,
          lesson_id: lessonId,
          is_completed: true,
          completed_at: new Date().toISOString(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson-progress"] });
      queryClient.invalidateQueries({ queryKey: ["enrollment"] });
      toast({ title: "Lesson marked as complete!" });
    },
  });

  // Prepare modules data with completion status
  const modules = course?.course_modules
    ?.sort((a: any, b: any) => a.order_index - b.order_index)
    .map((module: any) => ({
      id: module.id,
      title: module.title,
      order_index: module.order_index,
      lessons: module.lessons
        ?.sort((a: any, b: any) => a.order_index - b.order_index)
        .map((lesson: any) => ({
          id: lesson.id,
          title: lesson.title,
          order_index: lesson.order_index,
          isCompleted: lessonProgress?.some(
            (p: any) => p.lesson_id === lesson.id && p.is_completed
          ) || false,
        })) || [],
    })) || [];

  // Get all lessons in order for navigation
  const allLessons = modules.flatMap((module: any) =>
    module.lessons.map((lesson: any) => ({
      moduleId: module.id,
      lessonId: lesson.id,
    }))
  );

  const currentLessonIndex = allLessons.findIndex(
    (l) => l.moduleId === currentModuleId && l.lessonId === currentLessonId
  );

  const handleNext = () => {
    if (currentLessonIndex < allLessons.length - 1) {
      const next = allLessons[currentLessonIndex + 1];
      handleNavigateLesson(next.moduleId, next.lessonId);
    }
  };

  const handlePrev = () => {
    if (currentLessonIndex > 0) {
      const prev = allLessons[currentLessonIndex - 1];
      handleNavigateLesson(prev.moduleId, prev.lessonId);
    }
  };

  const handleNavigateOverview = () => {
    setCurrentView("overview");
    setCurrentModuleId(undefined);
    setCurrentLessonId(undefined);
  };

  const handleNavigateLesson = (moduleId: string, lessonId: string) => {
    setCurrentView("lesson");
    setCurrentModuleId(moduleId);
    setCurrentLessonId(lessonId);
  };

  const handleMarkComplete = () => {
    if (currentLessonId) {
      completeLessonMutation.mutate(currentLessonId);
    }
  };

  if (courseLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading course...</p>
        </div>
      </div>
    );
  }

  if (!course || !enrollment) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Course not found or you are not enrolled.
            </p>
            <Button
              className="w-full mt-4"
              onClick={() => navigate("/client/courses")}
            >
              Browse Courses
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLessonCompleted = currentLessonId
    ? lessonProgress?.some(
        (p: any) => p.lesson_id === currentLessonId && p.is_completed
      )
    : false;

  return (
    <CourseTemplateLayout
      courseName={course.title}
      providerName="Instructor" // You can fetch this from user_roles or profiles
      modules={modules}
      currentView={currentView}
      currentModuleId={currentModuleId}
      currentLessonId={currentLessonId}
      onNavigateOverview={handleNavigateOverview}
      onNavigateLesson={handleNavigateLesson}
      onNext={handleNext}
      onPrev={handlePrev}
      hasNext={currentLessonIndex < allLessons.length - 1}
      hasPrev={currentLessonIndex > 0}
    >
      {currentView === "overview" ? (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{course.title}</h1>
            <p className="text-muted-foreground">{course.description}</p>
          </div>

          {/* Course Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {enrollment.progress_percentage}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Course completion
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Modules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{modules.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Learning modules
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Lessons</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{allLessons.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total lessons
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Course Content Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Course Content</CardTitle>
              <CardDescription>
                {modules.length} modules • {allLessons.length} lessons
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {modules.map((module: any) => {
                const completedLessons = module.lessons.filter(
                  (l: any) => l.isCompleted
                ).length;
                return (
                  <div key={module.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold">{module.title}</h3>
                      <Badge variant="secondary">
                        {completedLessons}/{module.lessons.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {module.lessons.map((lesson: any) => (
                        <div
                          key={lesson.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          {lesson.isCompleted ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <PlayCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span
                            className={
                              lesson.isCompleted
                                ? "text-muted-foreground"
                                : ""
                            }
                          >
                            {lesson.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Start Learning Button */}
          {allLessons.length > 0 && (
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                const firstLesson = allLessons[0];
                handleNavigateLesson(firstLesson.moduleId, firstLesson.lessonId);
              }}
            >
              <PlayCircle className="mr-2 h-5 w-5" />
              {enrollment.progress_percentage > 0
                ? "Continue Learning"
                : "Start Learning"}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Lesson Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">
                {currentLesson?.title}
              </h1>
              {currentLesson?.description && (
                <p className="text-muted-foreground">
                  {currentLesson.description}
                </p>
              )}
              {currentLesson?.estimated_duration && (
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{currentLesson.estimated_duration} minutes</span>
                </div>
              )}
            </div>
            {!isLessonCompleted && (
              <Button
                onClick={handleMarkComplete}
                disabled={completeLessonMutation.isPending}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Mark Complete
              </Button>
            )}
            {isLessonCompleted && (
              <Badge className="bg-green-600">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Completed
              </Badge>
            )}
          </div>

          {/* Lesson Content */}
          {currentLesson?.lesson_content &&
          currentLesson.lesson_content.length > 0 ? (
            <div className="space-y-6">
              {currentLesson.lesson_content
                .sort((a: any, b: any) => a.order_index - b.order_index)
                .map((content: any) => (
                  <ContentRenderer
                    key={content.id}
                    content={content}
                    onComplete={handleMarkComplete}
                  />
                ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No content available for this lesson yet.</p>
            </div>
          )}
        </div>
      )}
    </CourseTemplateLayout>
  );
}
