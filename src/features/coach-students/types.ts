export interface LessonProgress {
  user_id: string;
  lesson_id: string;
  is_completed: boolean;
  started_at?: string;
  completed_at?: string;
}

export interface Course {
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

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
  updated_at: string;
}

export interface CoachEnrollment {
  id: string;
  user_id: string;
  course_id: string;
  enrolled_at: string;
  profiles: Profile;
  courses: Course | undefined;
}

export interface EnrolledCourse {
  id: string;
  title: string;
  progress: number;
  lastAccessed: string;
}

export interface CoachStudent {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  lastActive: string;
  status: "active" | "inactive";
  progress: number;
  completedLessons: number;
  totalLessons: number;
  enrolledCourses: EnrolledCourse[];
}

export type StudentSortOption =
  | "name-asc"
  | "name-desc"
  | "last-active-desc"
  | "progress-desc";
