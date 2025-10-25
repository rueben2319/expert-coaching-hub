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
import { Progress } from "@/components/ui/progress";

type ViewType = "overview" | "lesson";

export default function CourseViewer() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentView, setCurrentView] = useState<ViewType>("overview");
  const [currentModuleId, setCurrentModuleId] = useState<string | undefined>();
  const [currentLessonId, setCurrentLessonId] = useState<string | undefined>();
  const [isCheckingCompletion, setIsCheckingCompletion] = useState(false);

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
            lessons(
              *,
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

  // Fetch coach profile
  const { data: coachProfile } = useQuery({
    queryKey: ["coach-profile", course?.coach_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", course?.coach_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!course?.coach_id,
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

  // Fetch content interactions
  const { data: contentInteractions } = useQuery({
    queryKey: ["content-interactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_interactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
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

  // Auto-complete lesson when all required content is completed
  // Uses debouncing and locking to prevent race conditions
  useEffect(() => {
    const checkAndCompleteLesson = async () => {
      if (!currentLessonId || !currentLesson || !user) return;
      if (isCheckingCompletion) return; // Prevent concurrent checks

      const lessonContent = currentLesson?.lesson_content || [];
      const requiredContent = lessonContent.filter((content: any) => content.is_required);

      if (requiredContent.length === 0) return;

      // Check if all required content is completed
      const allRequiredCompleted = requiredContent.every((content: any) => {
        return contentInteractions?.some(
          (interaction: any) =>
            interaction.content_id === content.id && interaction.is_completed
        );
      });

      if (allRequiredCompleted) {
        // Check if lesson is already completed
        const isLessonAlreadyCompleted = lessonProgress?.some(
          (p: any) => p.lesson_id === currentLessonId && p.is_completed
        );

        if (!isLessonAlreadyCompleted) {
          setIsCheckingCompletion(true); // Lock
          try {
            console.log('Marking lesson complete:', currentLessonId);
            // Use the database function to mark lesson complete
            const { error } = await supabase.rpc("mark_lesson_complete", {
              _user_id: user.id,
              _lesson_id: currentLessonId,
            });

            if (!error) {
              // Refresh progress data
              queryClient.invalidateQueries({ queryKey: ["lesson-progress"] });
              queryClient.invalidateQueries({ queryKey: ["enrollment"] });
              toast({ title: "Lesson completed!", description: "Great progress!" });
            } else {
              console.error('Error marking lesson complete:', error);
            }
          } finally {
            setIsCheckingCompletion(false); // Unlock
          }
        }
      }
    };

    // Debounce to avoid rapid calls
    const timeoutId = setTimeout(() => {
      if (contentInteractions && currentLesson) {
        checkAndCompleteLesson();
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [currentLessonId, currentLesson, contentInteractions, lessonProgress, user, queryClient, isCheckingCompletion]);

  // Auto-create lesson progress when lesson is opened
  useEffect(() => {
    const createLessonProgress = async () => {
      if (!user || !currentLessonId) return;

      // Check if progress record already exists
      const { data: existingProgress } = await supabase
        .from("lesson_progress")
        .select("id")
        .eq("user_id", user.id)
        .eq("lesson_id", currentLessonId)
        .single();

      // Create progress record if it doesn't exist
      if (!existingProgress) {
        await supabase
          .from("lesson_progress")
          .insert({
            user_id: user.id,
            lesson_id: currentLessonId,
            is_completed: false,
          });

        // Invalidate queries to refresh progress data
        queryClient.invalidateQueries({ queryKey: ["lesson-progress"] });
      }
    };

    createLessonProgress();
  }, [currentLessonId, user, queryClient]);

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

  // Calculate overall course progress weighted by total lessons
  // This gives a more accurate representation than equal module weighting
  const calculateOverallProgress = () => {
    if (modules.length === 0) return 0;

    // Count total lessons across all modules
    const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
    if (totalLessons === 0) return 0;

    // Count completed lessons
    const completedLessons = modules.reduce((sum, m) => {
      return sum + m.lessons.filter((l: any) => l.isCompleted).length;
    }, 0);

    return Math.round((completedLessons / totalLessons) * 100);
  };

  const overallProgress = calculateOverallProgress();

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

  // Format duration helper
  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <CourseTemplateLayout
      courseName={course.title}
      providerName={coachProfile?.full_name || "Instructor"}
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
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
              {coachProfile?.full_name && (
                <span>By {coachProfile.full_name}</span>
              )}
              {course.total_duration > 0 && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{formatDuration(course.total_duration)}</span>
                  </div>
                </>
              )}
            </div>
            <p className="text-muted-foreground">{course.description}</p>
          </div>

          {/* Course Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">
                      {overallProgress}%
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {modules.filter(m => m.lessons.some(l => l.isCompleted)).length} of {modules.length}
                    </span>
                  </div>
                  <Progress
                    value={Math.max(overallProgress, 5)}
                    className="h-3"
                  />
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
              {/* Overall Course Progress Summary */}
              {enrollment && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Overall Progress</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {overallProgress}%
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({modules.filter(m => m.lessons.some(l => l.isCompleted)).length}/{modules.length})
                      </span>
                    </div>
                  </div>
                  <Progress
                    value={Math.max(overallProgress, 5)}
                    className="h-3"
                  />
                  <p className="text-xs text-muted-foreground">
                    Complete all lessons to finish this course
                  </p>
                </div>
              )}

              {modules.map((module: any) => {
                const completedLessons = module.lessons.filter(
                  (l: any) => l.isCompleted
                ).length;
                const moduleProgress = module.lessons.length > 0
                  ? Math.round((completedLessons / module.lessons.length) * 100)
                  : 0;

                return (
                  <div key={module.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold">{module.title}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {completedLessons}/{module.lessons.length}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {moduleProgress}%
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Progress value={moduleProgress} className="h-1.5" />
                      <div className="space-y-2">
                        {module.lessons.map((lesson: any) => (
                          <div
                            key={lesson.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            {lesson.isCompleted ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                            ) : (
                              <PlayCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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
              {overallProgress > 0
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
              {/* Lesson Progress */}
              {currentLesson?.lesson_content && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Lesson Progress</span>
                    <span className="font-medium">
                      {currentLesson.lesson_content.filter((content: any) =>
                        contentInteractions?.some(
                          (interaction: any) =>
                            interaction.content_id === content.id && interaction.is_completed
                        )
                      ).length} of {currentLesson.lesson_content.length} items completed
                    </span>
                  </div>
                  <Progress
                    value={
                      currentLesson.lesson_content.length > 0
                        ? (currentLesson.lesson_content.filter((content: any) =>
                            contentInteractions?.some(
                              (interaction: any) =>
                                interaction.content_id === content.id && interaction.is_completed
                            )
                          ).length / currentLesson.lesson_content.length) * 100
                        : 0
                    }
                    className="h-2"
                  />
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
                .map((content: any) => {
                  const isContentCompleted = contentInteractions?.some(
                    (interaction: any) =>
                      interaction.content_id === content.id && interaction.is_completed
                  );

                  return (
                    <div key={content.id} className="relative">
                      {/* Content completion indicator */}
                      <div className="absolute -left-8 top-2 z-10">
                        {isContentCompleted ? (
                          <div className="flex items-center justify-center w-6 h-6 bg-green-600 rounded-full">
                            <CheckCircle2 className="h-3 w-3 text-white" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center w-6 h-6 border-2 border-muted-foreground rounded-full">
                            <div className="w-2 h-2 bg-muted-foreground rounded-full opacity-50"></div>
                          </div>
                        )}
                      </div>

                      <ContentRenderer
                        key={content.id}
                        content={content}
                        onComplete={handleMarkComplete}
                      />
                    </div>
                  );
                })}
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
