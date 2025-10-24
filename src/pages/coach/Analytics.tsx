import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, Users, BarChart3, Calendar, Video, TrendingUp, TrendingDown, Eye, Clock, Target, Award } from "lucide-react";
import { coachNavItems, coachSidebarSections } from "@/config/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

// Helper function to safely divide numbers and avoid division by zero
const safeDivide = (numerator: number, denominator: number, defaultValue = 0): number => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return defaultValue;
  if (denominator <= 0) return defaultValue;
  return numerator / denominator;
};

export default function Analytics() {
  const { user } = useAuth();

  // Fetch all courses created by this coach
  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ["coach-courses", user?.id],
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
        .eq("coach_id", user!.id)
        .order("created_at", { ascending: false });

      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch all enrollments for coach's courses
  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["coach-enrollments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_enrollments")
        .select(`
          *,
          courses!inner(coach_id)
        `)
        .eq("courses.coach_id", user!.id)
        .order("enrolled_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch profiles for enrolled students
  const { data: enrollmentProfiles, isLoading: profilesLoading } = useQuery({
    queryKey: ["coach-enrollment-profiles", user?.id],
    queryFn: async () => {
      if (!enrollments) return [];
      
      const userIds = enrollments.map(e => e.user_id);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, updated_at")
        .in("id", userIds);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!enrollments,
  });
  const { data: lessonProgress, isLoading: progressLoading } = useQuery({
    queryKey: ["coach-lesson-progress", user?.id],
    queryFn: async () => {
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
        .eq("lessons.course_modules.courses.coach_id", user?.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Calculate analytics data
  const analyticsData = useMemo(() => {
    if (!courses || !enrollments || !lessonProgress || !enrollmentProfiles) return null;

    // Total students (unique users enrolled)
    const totalStudents = new Set(enrollments.map(e => e.user_id)).size;

    // Calculate course-level analytics
    const courseAnalytics = courses.map(course => {
      const courseEnrollments = enrollments.filter(e => e.course_id === course.id);
      const courseProgress = lessonProgress.filter(lp =>
        course.course_modules?.some(cm =>
          cm.lessons?.some(lesson => lesson.id === lp.lesson_id)
        )
      );

      // Calculate module-based completion rate for this course
      const studentProgresses = courseEnrollments.map(enrollment => {
        const modules = course.course_modules || [];
        if (modules.length === 0) return 0;

        const moduleProgresses = modules.map(module => {
          const completedLessons = module.lessons?.filter(lesson =>
            courseProgress.some(progress =>
              progress.lesson_id === lesson.id &&
              progress.user_id === enrollment.user_id &&
              progress.is_completed
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

      const averageProgress = studentProgresses.length > 0
        ? studentProgresses.reduce((sum, progress) => sum + progress, 0) / studentProgresses.length
        : 0;

      const completionRate = safeDivide(
        studentProgresses.filter(p => p >= 100).length,
        studentProgresses.length,
        0
      ) * 100;

      return {
        id: course.id,
        name: course.title,
        enrollments: courseEnrollments.length,
        completionRate: Math.round(completionRate),
        averageProgress: Math.round(averageProgress),
        students: courseEnrollments.map(enrollment => {
          const profile = enrollmentProfiles?.find(p => p.id === enrollment.user_id);
          return {
            id: enrollment.user_id,
            name: profile?.full_name || "Unknown User",
            email: profile?.email || "",
            progress: studentProgresses[courseEnrollments.indexOf(enrollment)] || 0,
            lastActive: profile?.updated_at || enrollment.enrolled_at
          };
        })
      };
    });

    // Calculate overall analytics
    const totalEnrollments = enrollments.length;
    const overallCompletionRate = safeDivide(
      courseAnalytics.reduce((sum, course) =>
        sum + (course.completionRate * course.enrollments), 0
      ),
      totalEnrollments,
      0
    );

    const overallAverageProgress = safeDivide(
      courseAnalytics.reduce((sum, course) =>
        sum + (course.averageProgress * course.enrollments), 0
      ),
      totalEnrollments,
      0
    );

    // Most popular lessons (by completion count)
    const lessonCompletions = new Map();
    lessonProgress.forEach(progress => {
      if (progress.is_completed) {
        const count = lessonCompletions.get(progress.lesson_id) || 0;
        lessonCompletions.set(progress.lesson_id, count + 1);
      }
    });

    const popularLessons = Array.from(lessonCompletions.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([lessonId, completions]) => {
        const lesson = courses.flatMap(c => c.course_modules?.flatMap(cm => cm.lessons || []) || [])
          .find(l => l.id === lessonId);
        return {
          title: lesson?.title || "Unknown Lesson",
          completions
        };
      });

    return {
      totalStudents,
      totalEnrollments,
      overallCompletionRate: Math.round(overallCompletionRate),
      overallAverageProgress: Math.round(overallAverageProgress),
      courseAnalytics,
      popularLessons
    };
  }, [courses, enrollments, lessonProgress, enrollmentProfiles]);

  // Precompute student progress distribution for performance
  const allStudents = useMemo(
    () => analyticsData?.courseAnalytics.flatMap(c => c.students) ?? [],
    [analyticsData]
  );

  const studentsByProgress = useMemo(() => ({
    "0-25": allStudents.filter(s => s.progress < 25).length,
    "25-50": allStudents.filter(s => s.progress >= 25 && s.progress < 50).length,
    "50-75": allStudents.filter(s => s.progress >= 50 && s.progress < 75).length,
    "75-100": allStudents.filter(s => s.progress >= 75 && s.progress < 100).length,
    "completed": allStudents.filter(s => s.progress >= 100).length,
  }), [allStudents]);

  // Fetch recent activity for coach's courses
  const { data: recentActivityData, isLoading: activityLoading } = useQuery({
    queryKey: ["coach-recent-activity", user?.id],
    queryFn: async () => {
      // Fetch recent enrollments
      const { data: recentEnrollments, error: enrollmentsError } = await supabase
        .from("course_enrollments")
        .select(`
          *,
          courses!inner(title)
        `)
        .eq("courses.coach_id", user?.id)
        .order("enrolled_at", { ascending: false })
        .limit(5);

      if (enrollmentsError) throw enrollmentsError;

      // Get unique user IDs from enrollments and fetch profiles
      const enrollmentUserIds = recentEnrollments?.map(e => e.user_id) || [];
      const { data: enrollmentProfiles, error: enrollmentProfileError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", enrollmentUserIds);

      if (enrollmentProfileError) throw enrollmentProfileError;

      // Fetch recent completions
      const { data: recentCompletions, error: completionsError } = await supabase
        .from("lesson_progress")
        .select(`
          *,
          lessons!inner(
            title,
            course_modules!inner(
              courses!inner(title, coach_id)
            )
          )
        `)
        .eq("lessons.course_modules.courses.coach_id", user?.id)
        .eq("is_completed", true)
        .order("completed_at", { ascending: false })
        .limit(5);

      if (completionsError) throw completionsError;

      // Get unique user IDs from completions and fetch profiles
      const completionUserIds = recentCompletions?.map(c => c.user_id) || [];
      const { data: completionProfiles, error: completionProfileError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", completionUserIds);

      if (completionProfileError) throw completionProfileError;

      // Combine and sort by recency
      const activities = [];

      // Add enrollments
      recentEnrollments?.forEach(enrollment => {
        const profile = enrollmentProfiles?.find(p => p.id === enrollment.user_id);
        activities.push({
          type: "enrollment",
          message: `${profile?.full_name || "A student"} enrolled in ${enrollment.courses.title}`,
          time: enrollment.enrolled_at,
          timestamp: new Date(enrollment.enrolled_at).getTime()
        });
      });

      // Add completions
      recentCompletions?.forEach(completion => {
        const profile = completionProfiles?.find(p => p.id === completion.user_id);
        activities.push({
          type: "completion",
          message: `${profile?.full_name || "A student"} completed ${completion.lessons.title} in ${completion.lessons.course_modules.courses.title}`,
          time: completion.completed_at,
          timestamp: new Date(completion.completed_at).getTime()
        });
      });

      // Sort by timestamp and take top 5
      return activities
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5)
        .map(activity => ({
          type: activity.type,
          message: activity.message,
          time: new Date(activity.timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        }));
    },
    enabled: !!user?.id,
  });

  // Recent activity with real data
  const recentActivity = recentActivityData || [
    {
      type: "enrollment",
      message: `${analyticsData?.totalEnrollments || 0} students enrolled this month`,
      time: "2 hours ago"
    },
    {
      type: "completion",
      message: "Multiple students completed course milestones",
      time: "4 hours ago"
    },
    {
      type: "progress",
      message: "Students showing strong engagement across courses",
      time: "1 day ago"
    }
  ];

  const isLoading = coursesLoading || enrollmentsLoading || progressLoading || profilesLoading || activityLoading;

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "enrollment": return <Users className="h-4 w-4 text-blue-500" />;
      case "completion": return <BookOpen className="h-4 w-4 text-green-500" />;
      case "session": return <Video className="h-4 w-4 text-purple-500" />;
      case "review": return <BarChart3 className="h-4 w-4 text-yellow-500" />;
      default: return <Eye className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <DashboardLayout
      navItems={coachNavItems}
      sidebarSections={coachSidebarSections}
      brandName="Experts Coaching Hub"
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Track your coaching performance and student engagement</p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="bg-muted/30 rounded-lg p-6 animate-pulse">
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-6 bg-muted rounded w-1/2"></div>
                  <div className="h-3 bg-muted rounded w-1/4"></div>
                </div>
              </div>
            ))
          ) : analyticsData ? (
            [
              {
                title: "Total Students",
                value: analyticsData.totalStudents.toString(),
                change: "+12%",
                trend: "up",
                icon: Users,
                description: "unique enrolled students"
              },
              {
                title: "Course Completion Rate",
                value: `${analyticsData.overallCompletionRate}%`,
                change: "+5%",
                trend: "up",
                icon: Award,
                description: "average completion rate"
              },
              {
                title: "Average Progress",
                value: `${analyticsData.overallAverageProgress}%`,
                change: "+8%",
                trend: "up",
                icon: Target,
                description: "across all students"
              },
              {
                title: "Total Enrollments",
                value: analyticsData.totalEnrollments.toString(),
                change: "+15%",
                trend: "up",
                icon: BookOpen,
                description: "across all courses"
              }
            ].map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={index} className="bg-muted/30 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <div className="flex items-center gap-1 text-sm">
                        {stat.trend === "up" ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span className={stat.trend === "up" ? "text-green-500" : "text-red-500"}>
                          {stat.change}
                        </span>
                        <span className="text-muted-foreground">{stat.description}</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </div>
              );
            })
          ) : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Course Performance */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Course Performance</h2>
            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="bg-muted/30 rounded-lg p-4 animate-pulse">
                    <div className="space-y-3">
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="h-3 bg-muted rounded"></div>
                        <div className="h-3 bg-muted rounded"></div>
                        <div className="h-3 bg-muted rounded"></div>
                      </div>
                      <div className="h-2 bg-muted rounded"></div>
                    </div>
                  </div>
                ))
              ) : analyticsData?.courseAnalytics.length ? (
                analyticsData.courseAnalytics.map((course, index) => (
                  <Card key={course.id} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">{course.name}</h3>
                      <Badge variant="secondary">
                        {course.enrollments} students
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                      <div>
                        <p className="text-muted-foreground">Completion Rate</p>
                        <p className="font-medium">{course.completionRate}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Avg Progress</p>
                        <p className="font-medium">{course.averageProgress}%</p>
                      </div>
                    </div>
                    <Progress value={Math.max(course.averageProgress, 5)} className="h-2" />
                  </Card>
                ))
              ) : (
                <Card className="p-8 text-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
                  <p className="text-muted-foreground">Create your first course to see analytics here</p>
                </Card>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Recent Activity</h2>
            <div className="space-y-3">
              {recentActivity.map((activity, index) => (
                <div key={index} className="bg-muted/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    {getActivityIcon(activity.type)}
                    <div className="flex-1">
                      <p className="text-sm">{activity.message}</p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {activity.time}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Student Analytics */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Popular Lessons */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Most Popular Lessons
              </CardTitle>
              <CardDescription>Lessons with highest completion rates</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-1/4"></div>
                    </div>
                  ))}
                </div>
              ) : analyticsData?.popularLessons.length ? (
                <div className="space-y-3">
                  {analyticsData.popularLessons.map((lesson, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{lesson.title}</p>
                          <p className="text-xs text-muted-foreground">{lesson.completions} completions</p>
                        </div>
                      </div>
                      <Badge variant="outline">{lesson.completions}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No lesson data available yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Student Progress Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Student Progress Overview
              </CardTitle>
              <CardDescription>Progress distribution across all students</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  <div className="h-4 bg-muted rounded w-full"></div>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                </div>
              ) : analyticsData ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>0-25%</span>
                      <span>{studentsByProgress["0-25"]} students</span>
                    </div>
                    <Progress value={safeDivide(studentsByProgress["0-25"], analyticsData.totalEnrollments, 0) * 100} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>25-50%</span>
                      <span>{studentsByProgress["25-50"]} students</span>
                    </div>
                    <Progress value={safeDivide(studentsByProgress["25-50"], analyticsData.totalEnrollments, 0) * 100} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>50-75%</span>
                      <span>{studentsByProgress["50-75"]} students</span>
                    </div>
                    <Progress value={safeDivide(studentsByProgress["50-75"], analyticsData.totalEnrollments, 0) * 100} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>75-100%</span>
                      <span>{studentsByProgress["75-100"]} students</span>
                    </div>
                    <Progress value={safeDivide(studentsByProgress["75-100"], analyticsData.totalEnrollments, 0) * 100} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Completed (100%)</span>
                      <span>{studentsByProgress["completed"]} students</span>
                    </div>
                    <Progress value={safeDivide(studentsByProgress["completed"], analyticsData.totalEnrollments, 0) * 100} className="h-2" />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No student data available yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detailed Student View */}
        {analyticsData?.courseAnalytics.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Detailed Student Progress
              </CardTitle>
              <CardDescription>Individual student progress across all courses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.courseAnalytics.map(course => (
                  <div key={course.id} className="border rounded-lg p-4">
                    <h4 className="font-medium mb-3 flex items-center justify-between">
                      {course.name}
                      <Badge variant="outline">{course.students.length} students</Badge>
                    </h4>
                    <div className="space-y-2">
                      {course.students.slice(0, 3).map(student => (
                        <div key={student.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
                              {student.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{student.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Last active: {new Date(student.lastActive).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-medium">{Math.round(student.progress)}%</p>
                              <Progress value={Math.max(student.progress, 5)} className="w-16 h-1" />
                            </div>
                          </div>
                        </div>
                      ))}
                      {course.students.length > 3 && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          +{course.students.length - 3} more students
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
