import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { DashboardLayout } from "@/components/DashboardLayout";
import { BookOpen, Users, BarChart3, Calendar, Video, Search, Filter, MoreHorizontal, TrendingUp, Clock, CheckCircle, Plus, Mail, MessageCircle } from "lucide-react";
import { coachNavItems, coachSidebarSections } from "@/config/navigation";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Students() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch students enrolled in coach's courses
  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["coach-students", user?.id],
    queryFn: async () => {
      // First get enrollments for coach's courses
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from("course_enrollments")
        .select(`
          *,
          courses!inner(
            id,
            title,
            coach_id,
            course_modules(
              id,
              lessons(id)
            )
          )
        `)
        .eq("courses.coach_id", user?.id);
      
      if (enrollmentError) throw enrollmentError;
      if (!enrollmentData?.length) return [];

      // Get unique user IDs
      const userIds = [...new Set(enrollmentData.map(e => e.user_id))];
      
      // Fetch profiles for these users
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, updated_at")
        .in("id", userIds);
        
      if (profileError) throw profileError;

      // Combine the data
      return enrollmentData.map(enrollment => ({
        ...enrollment,
        profiles: profileData?.find(p => p.id === enrollment.user_id)
      }));
    },
    enabled: !!user?.id,
  });

  // Fetch lesson progress for students
  const { data: progressData, isLoading: progressLoading } = useQuery({
    queryKey: ["students-progress", user?.id],
    queryFn: async () => {
      if (!enrollments?.length) return [];
      
      const studentIds = enrollments.map(e => e.user_id);
      const { data, error } = await supabase
        .from("lesson_progress")
        .select(`
          *,
          lessons!inner(
            id,
            course_modules!inner(
              courses!inner(coach_id)
            )
          )
        `)
        .in("user_id", studentIds)
        .eq("lessons.course_modules.courses.coach_id", user?.id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!enrollments?.length,
  });

  // Process and group student data
  const students = useMemo(() => {
    if (!enrollments) return [];

    const studentMap = new Map();

    enrollments.forEach((enrollment) => {
      const studentId = enrollment.user_id;
      const profile = enrollment.profiles;
      const student = studentMap.get(studentId) || {
        id: studentId,
        name: profile?.full_name || "Unknown User",
        email: profile?.email || "",
        avatar: (profile?.full_name || "U").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2),
        enrolledCourses: [],
        enrollments: [], // Store full enrollment data for progress calculation
        enrolledAt: enrollment.enrolled_at,
        lastActive: profile?.updated_at,
        totalLessons: 0,
        completedLessons: 0,
      };

      student.enrolledCourses.push(enrollment.courses.title);
      student.enrollments.push(enrollment);
      studentMap.set(studentId, student);
    });

    // Calculate module-based progress for each student
    progressData?.forEach((progress) => {
      const student = studentMap.get(progress.user_id);
      if (student) {
        student.totalLessons = (student.totalLessons || 0) + 1;
        if (progress.is_completed) {
          student.completedLessons = (student.completedLessons || 0) + 1;
        }
      }
    });

    return Array.from(studentMap.values()).map(student => {
      // Calculate module-based progress across all enrolled courses
      const courseProgresses = student.enrollments.map(enrollment => {
        const modules = enrollment.courses?.course_modules || [];
        if (modules.length === 0) return 0;

        const moduleProgresses = modules.map(module => {
          const completedLessons = module.lessons?.filter((lesson: any) =>
            progressData?.some((progress) =>
              progress.lesson_id === lesson.id && progress.user_id === student.id && progress.is_completed
            )
          ).length || 0;

          return module.lessons?.length > 0
            ? (completedLessons / module.lessons.length) * 100
            : 0;
        });

        return moduleProgresses.length > 0
          ? moduleProgresses.reduce((sum, progress) => sum + progress, 0) / moduleProgresses.length
          : 0;
      });

      const overallProgress = courseProgresses.length > 0
        ? Math.round(courseProgresses.reduce((sum, progress) => sum + progress, 0) / courseProgresses.length)
        : 0;

      return {
        ...student,
        progress: overallProgress,
        status: new Date(student.lastActive) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) ? "active" : "inactive"
      };
    });
  }, [enrollments, progressData]);

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "inactive": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <DashboardLayout
      navItems={coachNavItems}
      sidebarSections={coachSidebarSections}
      brandName="Experts Coaching Hub"
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Students</h1>
            <p className="text-muted-foreground">Manage and track your students' progress</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
          </div>
        </div>

        {enrollmentsLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading students...</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredStudents.map((student) => (
            <div key={student.id} className="bg-muted/30 rounded-lg p-4 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center font-semibold text-primary mx-auto sm:mx-0">
                    {student.avatar}
                  </div>
                  <div className="space-y-2 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      <h3 className="text-lg font-semibold">{student.name}</h3>
                      <Badge className={getStatusColor(student.status)}>
                        {student.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{student.email}</p>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 gap-1 text-sm text-muted-foreground">
                      <span>Last active: {new Date(student.lastActive).toLocaleDateString()}</span>
                      <span>{student.enrolledCourses.length} courses</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Overall Progress</span>
                      <span className="font-medium">{student.progress}%</span>
                    </div>
                    <Progress value={Math.max(student.progress, 5)} className="w-full sm:w-32 h-2" />
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button variant="outline" size="sm" className="w-full sm:w-auto">
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </Button>
                    <Button variant="outline" size="sm" className="w-full sm:w-auto">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Message
                    </Button>
                    <Button variant="outline" size="sm" className="w-full sm:w-auto">
                      View Profile
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-medium mb-2">Enrolled Courses:</h4>
                <div className="flex flex-wrap gap-2">
                  {student.enrolledCourses.map((course, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {course}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}
          </div>
        )}

        {!enrollmentsLoading && filteredStudents.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? "No students found" : "No students yet"}
            </h3>
            <p className="text-muted-foreground">
              {searchTerm 
                ? "Try adjusting your search terms" 
                : "Students will appear here when they enroll in your courses"
              }
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
