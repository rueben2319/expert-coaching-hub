import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { DashboardLayout } from "@/components/DashboardLayout";
import { BookOpen, Users, BarChart3, Calendar, Video, Search, Filter, MoreHorizontal, TrendingUp, Clock, CheckCircle, Plus, Mail, MessageCircle } from "lucide-react";
import { coachSidebarSections } from "@/config/navigation";
import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LessonProgress {
  user_id: string;
  lesson_id: string;
  is_completed: boolean;
  started_at?: string;
  completed_at?: string;
}

interface Course {
  id: string;
  title: string;
  course_modules?: Array<{
    id: string;
    title: string;
    lessons?: Array<{
      id: string;
      title: string;
    }>;
  }>;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  updated_at: string;
}

interface EnrolledCourse {
  id: string;
  title: string;
  progress: number;
  lastAccessed: string;
}

interface Student {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  lastActive: string;
  status: 'active' | 'inactive';
  progress: number;
  enrollments: Array<{
    course_id: string;
    courses?: Course;
  }>;
  completedLessons: number;
  totalLessons: number;
  enrolledCourses: EnrolledCourse[];
}

export default function Students() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || "");

  // Update search term when URL params change
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    if (urlSearch !== searchTerm) {
      setSearchTerm(urlSearch);
    }
  }, [searchParams]);

  // Fetch coach's courses first
  const { data: coachCourses, isLoading: coursesLoading } = useQuery<Course[]>({
    queryKey: ["coach-courses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          id,
          title,
          course_modules(
            id,
            title,
            lessons(
              id,
              title
            )
          )
        `)
        .eq("coach_id", user?.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch enrollments for coach's courses
  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery<{
    id: string;
    user_id: string;
    course_id: string;
    enrolled_at: string;
    profiles: Profile;
    courses: Course | undefined;
  }[]>({
    queryKey: ["coach-students", user?.id],
    queryFn: async () => {
      if (!coachCourses?.length) return [];
      
      const courseIds = coachCourses.map(course => course.id);
      
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from("course_enrollments")
        .select(`
          id,
          user_id,
          course_id,
          enrolled_at,
          profiles!inner(
            id,
            full_name,
            email,
            avatar_url,
            updated_at
          )
        `)
        .in("course_id", courseIds)
        .order("enrolled_at", { ascending: false });
      
      if (enrollmentError) throw enrollmentError;
      if (!enrollmentData?.length) return [];

      return enrollmentData.map(enrollment => ({
        id: enrollment.id,
        user_id: enrollment.user_id,
        course_id: enrollment.course_id,
        enrolled_at: enrollment.enrolled_at,
        profiles: enrollment.profiles,
        courses: coachCourses.find(c => c.id === enrollment.course_id)
      }));
    },
    enabled: !!user?.id && !!coachCourses,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000
  });

  // Fetch lesson progress for students - FIXED: Removed duplicate declaration
  const { data: progressData, isLoading: progressLoading } = useQuery<LessonProgress[]>({
    queryKey: ["students-progress", user?.id, enrollments?.length],
    queryFn: async () => {
      if (!enrollments?.length) return [];
      
      const studentIds = [...new Set(enrollments.map(e => e.user_id))];
      const allLessonIds = coachCourses?.flatMap(course => 
        course.course_modules?.flatMap(module => 
          module.lessons?.map(lesson => lesson.id) || []
        ) || []
      ) || [];
      
      if (allLessonIds.length === 0) return [];
      
      const CHUNK_SIZE = 50;
      let allProgress: LessonProgress[] = [];
      
      for (let i = 0; i < allLessonIds.length; i += CHUNK_SIZE) {
        const chunk = allLessonIds.slice(i, i + CHUNK_SIZE);
        const { data, error } = await supabase
          .from("lesson_progress")
          .select(`
            user_id,
            lesson_id,
            is_completed,
            started_at,
            completed_at
          `)
          .in("user_id", studentIds)
          .in("lesson_id", chunk);
          
        if (error) throw error;
        if (data) allProgress = [...allProgress, ...data];
      }
      
      return allProgress;
    },
    enabled: !!user?.id && !!enrollments?.length,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000
  });

  // Process and group student data
  const students = useMemo<Student[]>(() => {
    if (!enrollments || !progressData) return [];

    const studentMap = new Map<string, Student>();

    enrollments.forEach(enrollment => {
      if (!enrollment.profiles) return;

      const studentId = enrollment.user_id;
      const course = enrollment.courses;
      const profile = enrollment.profiles;
      
      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          id: studentId,
          name: profile.full_name || 'Unknown',
          email: profile.email || '',
          avatar: profile.avatar_url,
          lastActive: enrollment.last_accessed || enrollment.enrolled_at,
          status: 'inactive',
          progress: 0,
          enrollments: [],
          completedLessons: 0,
          totalLessons: 0,
          enrolledCourses: []
        });
      }
      
      const student = studentMap.get(studentId)!;
      student.enrollments.push({
        course_id: enrollment.course_id,
        courses: course
      });
    });

    progressData.forEach(progress => {
      const student = studentMap.get(progress.user_id);
      if (!student) return;

      const lastActive = progress.completed_at || progress.started_at;
      if (lastActive && new Date(lastActive) > new Date(student.lastActive)) {
        student.lastActive = lastActive;
      }

      if (progress.is_completed) {
        student.completedLessons++;
      }
    });

    return Array.from(studentMap.values()).map(student => {
      let totalLessons = 0;
      let completedInCourses = 0;
      let totalCourses = 0;

      student.enrollments.forEach(enrollment => {
        const course = enrollment.courses;
        if (!course) return;

        const courseLessons = course.course_modules?.flatMap(m => m.lessons || []) || [];
        totalLessons += courseLessons.length;
        
        if (courseLessons.length > 0) {
          const completed = progressData.filter(p => 
            p.user_id === student.id && 
            p.is_completed && 
            courseLessons.some(l => l.id === p.lesson_id)
          ).length;
          
          completedInCourses += completed;
          totalCourses++;
        }
      });

      const progress = totalLessons > 0 
        ? Math.round((student.completedLessons / totalLessons) * 100) 
        : 0;
      
      const isActive = new Date(student.lastActive) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      // FIXED: Properly construct enrolledCourses array
      const enrolledCourses: EnrolledCourse[] = student.enrollments
        .filter(e => e.courses)
        .map(e => ({
          id: e.course_id,
          title: e.courses?.title || 'Unknown Course',
          progress: 0,
          lastAccessed: student.lastActive
        }));
      
      return {
        ...student,
        progress,
        status: isActive ? 'active' : 'inactive' as 'active' | 'inactive',
        totalLessons,
        enrolledCourses
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

  // FIXED: Function to get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <DashboardLayout
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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (e.target.value) {
                    setSearchParams({ search: e.target.value });
                  } else {
                    setSearchParams({});
                  }
                }}
                className="pl-10"
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
                    {/* FIXED: Avatar rendering */}
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center font-semibold text-primary mx-auto sm:mx-0 overflow-hidden">
                      {student.avatar ? (
                        <img 
                          src={student.avatar} 
                          alt={student.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getInitials(student.name)
                      )}
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
                    {/* FIXED: Properly render course titles */}
                    {student.enrolledCourses.map((course) => (
                      <Badge key={course.id} variant="secondary" className="text-xs">
                        {course.title}
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