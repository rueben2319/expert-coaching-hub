export type CourseProgressDetail = {
  id: string | null;
  title: string;
  progress: number;
  completedLessons: number;
  totalLessons: number;
};

export type CompletionMetrics = {
  totalCourses: number;
  completedCourses: number;
  completionRate: number;
};

export type WeeklyActivityPoint = {
  day: string;
  lessons: number;
};

export type StudyTimeTrendPoint = {
  date: string;
  minutes: number;
};
