import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Users, BarChart3, Calendar, Video, Plus, TrendingUp, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { coachSidebarSections } from "@/config/navigation";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function CoachDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  // Fetch coach's courses
  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ["coach-courses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          *,
          course_modules(
            id,
            lessons(
              id,
              lesson_content(id)
            )
          )
        `)
        .eq("coach_id", user?.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch total students across all courses
  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["coach-enrollments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_enrollments")
        .select(`
          *,
          courses!inner(coach_id)
        `)
        .eq("courses.coach_id", user?.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Calculate analytics data
  const totalCourses = courses?.length || 0;
  const totalStudents = enrollments?.length || 0;
  const totalLessons = courses?.reduce((acc, course) => {
    return acc + (course.course_modules?.reduce((moduleAcc: number, module: any) => {
      return moduleAcc + (module.lessons?.length || 0);
    }, 0) || 0);
  }, 0) || 0;

  const totalContent = courses?.reduce((acc, course) => {
    return acc + (course.course_modules?.reduce((moduleAcc: number, module: any) => {
      return moduleAcc + (module.lessons?.reduce((lessonAcc: number, lesson: any) => {
        return lessonAcc + (lesson.lesson_content?.length || 0);
      }, 0) || 0);
    }, 0) || 0);
  }, 0) || 0;

  // Initial page load skeleton
  if ((coursesLoading || enrollmentsLoading) && !courses) {
    return (
      <DashboardLayout
        sidebarSections={coachSidebarSections}
        brandName="Experts Coaching Hub"
      >
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-10 w-48 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-12 w-12 rounded-lg mb-4" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-32 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      sidebarSections={coachSidebarSections}
      brandName="Experts Coaching Hub"
    >
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Coach Dashboard
          </h1>
          <p className="text-muted-foreground">Create and manage your courses</p>
        </div>
        <Button 
          className="bg-gradient-to-r from-primary to-accent hover:opacity-90 w-full sm:w-auto"
          onClick={() => navigate("/coach/courses/create")}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Course
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/coach/courses")}>
          <CardHeader>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>My Courses</CardTitle>
            <CardDescription>Manage your course content</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2 text-primary">
              {coursesLoading ? "..." : totalCourses}
            </div>
            <p className="text-sm text-muted-foreground">
              {totalCourses === 1 ? "Course created" : "Courses created"}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/coach/students")}>
          <CardHeader>
            <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-accent" />
            </div>
            <CardTitle>Students</CardTitle>
            <CardDescription>View your enrolled students</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2 text-accent">
              {enrollmentsLoading ? "..." : totalStudents}
            </div>
            <p className="text-sm text-muted-foreground">
              {totalStudents === 1 ? "Student enrolled" : "Students enrolled"}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/coach/analytics")}>
          <CardHeader>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <Video className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle>Lessons</CardTitle>
            <CardDescription>Total lesson content</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2 text-green-600">
              {coursesLoading ? "..." : totalLessons}
            </div>
            <p className="text-sm text-muted-foreground">
              {totalLessons === 1 ? "Lesson created" : "Lessons created"}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/coach/analytics")}>
          <CardHeader>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
            <CardTitle>Content Items</CardTitle>
            <CardDescription>Total content pieces</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2 text-blue-600">
              {coursesLoading ? "..." : totalContent}
            </div>
            <p className="text-sm text-muted-foreground">
              {totalContent === 1 ? "Content item" : "Content items"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Section */}
      {courses && courses.length > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="text-2xl font-semibold">Recent Courses</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.slice(0, 3).map((course) => (
              <Card key={course.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/coach/courses/${course.id}/edit`)}>
                <CardHeader>
                  <CardTitle className="text-lg">{course.title}</CardTitle>
                  <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <BookOpen className="h-4 w-4" />
                      {course.course_modules?.length || 0} modules
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {new Date(course.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {courses && courses.length === 0 && !coursesLoading && (
        <div className="mt-8 text-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first course to start coaching students
          </p>
          <Button onClick={() => navigate("/coach/courses/create")}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Course
          </Button>
        </div>
      )}
    </DashboardLayout>
  );
}
