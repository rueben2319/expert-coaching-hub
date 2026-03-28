import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type {
  CoachEnrollment,
  CoachStudent,
  Course,
  LessonProgress,
  Profile,
} from "@/features/coach-students/types";

interface UseCoachStudentsDataOptions {
  coachId?: string;
}

export function useCoachStudentsData({ coachId }: UseCoachStudentsDataOptions) {
  const coursesQuery = useQuery<Course[]>({
    queryKey: ["coach-courses", coachId],
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
        .eq("coach_id", coachId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!coachId,
  });

  const enrollmentsQuery = useQuery<CoachEnrollment[]>({
    queryKey: ["coach-students", coachId, coursesQuery.data?.length],
    queryFn: async () => {
      const coachCourses = coursesQuery.data ?? [];
      if (!coachCourses.length) return [];

      const courseIds = coachCourses.map((course) => course.id);
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from("course_enrollments")
        .select("id, user_id, course_id, enrolled_at")
        .in("course_id", courseIds)
        .order("enrolled_at", { ascending: false });

      if (enrollmentError) throw enrollmentError;
      if (!enrollmentData?.length) return [];

      const userIds = [...new Set(enrollmentData.map((enrollment) => enrollment.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, updated_at")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((profile) => [profile.id, profile]) || []);

      return enrollmentData.map((enrollment) => ({
        id: enrollment.id,
        user_id: enrollment.user_id,
        course_id: enrollment.course_id,
        enrolled_at: enrollment.enrolled_at,
        profiles: (profileMap.get(enrollment.user_id) as Profile | undefined) || {
          id: enrollment.user_id,
          full_name: "Unknown",
          email: "",
          avatar_url: null,
          updated_at: new Date().toISOString(),
        },
        courses: coachCourses.find((course) => course.id === enrollment.course_id),
      }));
    },
    enabled: !!coachId && !!coursesQuery.data?.length,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const progressQuery = useQuery<LessonProgress[]>({
    queryKey: ["students-progress", coachId, enrollmentsQuery.data?.length],
    queryFn: async () => {
      const coachCourses = coursesQuery.data ?? [];
      const enrollments = enrollmentsQuery.data ?? [];
      if (!enrollments.length) return [];

      const studentIds = [...new Set(enrollments.map((enrollment) => enrollment.user_id))];
      const allLessonIds = coachCourses.flatMap(
        (course) => course.course_modules?.flatMap((module) => module.lessons?.map((lesson) => lesson.id) || []) || [],
      );

      if (!allLessonIds.length) return [];

      const CHUNK_SIZE = 50;
      let allProgress: LessonProgress[] = [];

      for (let i = 0; i < allLessonIds.length; i += CHUNK_SIZE) {
        const chunk = allLessonIds.slice(i, i + CHUNK_SIZE);
        const { data, error } = await supabase
          .from("lesson_progress")
          .select("user_id, lesson_id, is_completed, started_at, completed_at")
          .in("user_id", studentIds)
          .in("lesson_id", chunk);

        if (error) throw error;
        if (data) {
          allProgress = [...allProgress, ...data];
        }
      }

      return allProgress;
    },
    enabled: !!coachId && !!enrollmentsQuery.data?.length,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const students = useMemo<CoachStudent[]>(() => {
    const enrollments = enrollmentsQuery.data;
    const progressData = progressQuery.data;

    if (!enrollments || !progressData) return [];

    const studentMap = new Map<string, CoachStudent & { enrollmentCourses: Course[] }>();

    enrollments.forEach((enrollment) => {
      const profile = enrollment.profiles;
      if (!profile) return;

      const studentId = enrollment.user_id;
      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          id: studentId,
          name: profile.full_name || "Unknown",
          email: profile.email || "",
          avatar: profile.avatar_url,
          lastActive: enrollment.enrolled_at,
          status: "inactive",
          progress: 0,
          completedLessons: 0,
          totalLessons: 0,
          enrolledCourses: [],
          enrollmentCourses: [],
        });
      }

      const student = studentMap.get(studentId);
      if (!student) return;

      if (enrollment.courses) {
        student.enrollmentCourses.push(enrollment.courses);
      }
    });

    progressData.forEach((progress) => {
      const student = studentMap.get(progress.user_id);
      if (!student) return;

      const lastActive = progress.completed_at || progress.started_at;
      if (lastActive && new Date(lastActive) > new Date(student.lastActive)) {
        student.lastActive = lastActive;
      }

      if (progress.is_completed) {
        student.completedLessons += 1;
      }
    });

    return Array.from(studentMap.values()).map((student) => {
      const uniqueCourses = Array.from(new Map(student.enrollmentCourses.map((course) => [course.id, course])).values());
      const totalLessons = uniqueCourses.reduce(
        (sum, course) => sum + (course.course_modules?.flatMap((module) => module.lessons || []).length || 0),
        0,
      );

      const progress = totalLessons > 0 ? Math.round((student.completedLessons / totalLessons) * 100) : 0;
      const isActive = new Date(student.lastActive) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      return {
        ...student,
        totalLessons,
        progress,
        status: isActive ? "active" : "inactive",
        enrolledCourses: uniqueCourses.map((course) => ({
          id: course.id,
          title: course.title || "Unknown Course",
          progress: 0,
          lastAccessed: student.lastActive,
        })),
      };
    });
  }, [enrollmentsQuery.data, progressQuery.data]);

  const isLoading = coursesQuery.isLoading || enrollmentsQuery.isLoading || progressQuery.isLoading;
  const isError = coursesQuery.isError || enrollmentsQuery.isError || progressQuery.isError;
  const error = coursesQuery.error || enrollmentsQuery.error || progressQuery.error || null;

  return {
    students,
    courses: coursesQuery.data ?? [],
    enrollments: enrollmentsQuery.data ?? [],
    progressData: progressQuery.data ?? [],
    isLoading,
    isError,
    error,
    refetch: async () => {
      await Promise.all([coursesQuery.refetch(), enrollmentsQuery.refetch(), progressQuery.refetch()]);
    },
  };
}
