import { useNavigate, useSearchParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Clock, Coins, Search, ArrowRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { clientSidebarSections } from "@/config/navigation";
import { useCredits } from "@/hooks/useCredits";
import { CreditWallet } from "@/components/CreditWallet";
import { Progress } from "@/components/ui/progress";
import {
  useEnrollmentProgress,
  type CourseCardViewModel,
  type CourseModuleRef,
} from "@/hooks/useEnrollmentProgress";

type CourseEnrollmentRef = {
  user_id: string;
};

type CatalogCourse = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  tag: string | null;
  level: string | null;
  is_free: boolean | null;
  price_credits: number | null;
  course_enrollments?: CourseEnrollmentRef[];
  course_modules?: Array<
    CourseModuleRef & {
      lessons?: Array<{
        id: string;
        estimated_duration: number | null;
      }>;
    }
  >;
};

type CatalogCourseViewModel = CourseCardViewModel & {
  level: string | null;
  isFree: boolean;
  priceCredits: number;
  totalDuration: number;
  enrolled: boolean;
  rawCourse: CatalogCourse;
  searchText: string;
};

export default function Courses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enrollWithCredits, balance } = useCredits();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get("search") || "";
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [priceFilter, setPriceFilter] = useState<string>("all");

  const { calculateCourseProgress, isLoading: progressLoading } = useEnrollmentProgress(user?.id);

  const { data: courses, isLoading: coursesLoading } = useQuery<CatalogCourse[]>({
    queryKey: ["published-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          id, title, description, category, tag, level, is_free, price_credits,
          course_enrollments!left(user_id),
          course_modules(
            id,
            lessons(
              id,
              estimated_duration
            )
          )
        `)
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as CatalogCourse[];
    },
  });

  const enrollMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase.from("course_enrollments").insert({
        user_id: user!.id,
        course_id: courseId,
        payment_status: "free",
        credits_paid: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["published-courses"] });
      queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });
      toast({ title: "Enrolled successfully!" });
    },
    onError: (error: Error) => {
      if (error.message?.includes("duplicate")) {
        toast({ title: "Already enrolled", variant: "destructive" });
      } else {
        toast({ title: "Failed to enroll", variant: "destructive" });
      }
    },
  });

  const isEnrolled = (course: CatalogCourse) =>
    course.course_enrollments?.some((enrollment) => enrollment.user_id === user?.id) ?? false;

  const handleEnrollClick = (course: CatalogCourse) => {
    if (isEnrolled(course)) {
      navigate(`/client/course/${course.id}`);
      return;
    }

    const isFree = course.is_free || !course.price_credits || course.price_credits === 0;

    if (isFree) {
      enrollMutation.mutate(course.id);
      return;
    }

    if (balance < (course.price_credits ?? 0)) {
      toast({
        title: "Insufficient credits",
        description: `You need ${course.price_credits} credits. Buy more credits to enroll.`,
        variant: "destructive",
      });
      return;
    }

    enrollWithCredits.mutate(course.id);
  };

  const courseCards = useMemo<CatalogCourseViewModel[]>(() => {
    if (!courses) return [];

    return courses.map((course) => {
      const totalDuration = (course.course_modules ?? []).reduce((courseTotal, module) => {
        const moduleTotal = (module.lessons ?? []).reduce(
          (lessonTotal, lesson) => lessonTotal + (lesson.estimated_duration ?? 0),
          0,
        );
        return courseTotal + moduleTotal;
      }, 0);

      const enrolled =
        course.course_enrollments?.some((enrollment) => enrollment.user_id === user?.id) ?? false;

      return {
        enrollmentId: course.id,
        courseId: course.id,
        title: course.title,
        description: course.description ?? "Discover this course and start building momentum.",
        progress: enrolled ? calculateCourseProgress(course) : 0,
        level: course.level,
        isFree: Boolean(course.is_free || !course.price_credits || course.price_credits === 0),
        priceCredits: course.price_credits ?? 0,
        totalDuration,
        enrolled,
        rawCourse: course,
        searchText: [course.title, course.description, course.category, course.tag].filter(Boolean).join(" ").toLowerCase(),
      };
    });
  }, [courses, calculateCourseProgress, user?.id]);

  const filteredCourses = useMemo(() => {
    let filtered = courseCards;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((course) =>
        course.searchText.includes(query),
      );
    }

    if (levelFilter !== "all") {
      filtered = filtered.filter((course) => course.level === levelFilter);
    }

    if (priceFilter === "free") {
      filtered = filtered.filter((course) => course.isFree);
    } else if (priceFilter === "paid") {
      filtered = filtered.filter((course) => !course.isFree);
    }

    return filtered;
  }, [courseCards, searchQuery, levelFilter, priceFilter]);

  const handleSearch = (value: string) => {
    setLocalSearch(value);
    if (value) {
      setSearchParams({ search: value });
    } else {
      setSearchParams({});
    }
  };

  const LevelIndicator = ({ level }: { level?: string | null }) => {
    if (!level) return null;

    const bars = level === "introduction" ? 1 : level === "intermediate" ? 2 : 3;

    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3].map((bar) => (
          <div
            key={bar}
            className={`w-1 rounded-full transition-colors ${bar <= bars ? "bg-primary h-3" : "bg-muted h-2"}`}
          />
        ))}
      </div>
    );
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const isLoading = coursesLoading || progressLoading;

  return (
    <DashboardLayout sidebarSections={clientSidebarSections}>
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="text-center space-y-4 py-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Discover learning for in-demand skills
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Your home for building AI skills and more. Get hands-on with courses and learn directly
            from the experts.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search catalog..."
              value={localSearch}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-12 pr-12 h-12 text-base rounded-full border-2 focus:border-primary"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => {
                  setLocalSearch("");
                  setSearchParams({});
                }}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Clear search"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-3 w-full sm:w-auto">
            <Select value={priceFilter} onValueChange={setPriceFilter}>
              <SelectTrigger className="w-[140px] rounded-full">
                <SelectValue placeholder="Price" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>

            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-[140px] rounded-full">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="introduction">Introduction</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <CreditWallet compact />
        </div>

        <div className="text-sm text-muted-foreground">
          {filteredCourses.length} result{filteredCourses.length !== 1 ? "s" : ""}
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading courses...</div>
        ) : filteredCourses.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map((course) => (
              <Card
                key={course.courseId}
                className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/50 cursor-pointer overflow-hidden flex flex-col"
                onClick={() =>
                  course.enrolled
                    ? navigate(`/client/course/${course.courseId}`)
                    : handleEnrollClick(course.rawCourse)
                }
              >
                <CardHeader className="space-y-3 pb-4 flex-shrink-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <LevelIndicator level={course.level} />

                    {course.enrolled ? (
                      <Badge variant="secondary" className="rounded-full px-3">
                        Enrolled
                      </Badge>
                    ) : course.isFree ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 rounded-full px-3">
                        Free
                      </Badge>
                    ) : (
                      <Badge className="rounded-full px-3 flex items-center gap-1">
                        <Coins className="h-3 w-3" />
                        {course.priceCredits} Credits
                      </Badge>
                    )}
                  </div>

                  <CardTitle className="line-clamp-2 text-xl group-hover:text-primary transition-colors">
                    {course.title}
                  </CardTitle>

                  <CardDescription className="line-clamp-3 text-sm leading-relaxed">
                    {course.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col flex-grow mt-auto pt-0">
                  {course.enrolled && (
                    <div className="space-y-2 mb-4">
                      <Progress value={Math.max(course.progress, 5)} />
                      <p className="text-xs text-muted-foreground">{course.progress}% complete</p>
                    </div>
                  )}

                  {course.totalDuration > 0 && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
                      <Clock className="h-4 w-4" />
                      <span>{formatDuration(course.totalDuration)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-auto">
                    {course.enrolled ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 group-hover:bg-primary/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/client/course/${course.courseId}`);
                        }}
                      >
                        Continue Learning
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 group-hover:bg-primary/10"
                        disabled={enrollMutation.isPending || enrollWithCredits.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEnrollClick(course.rawCourse);
                        }}
                      >
                        {enrollMutation.isPending || enrollWithCredits.isPending
                          ? "Enrolling..."
                          : course.isFree
                            ? "Enroll Free"
                            : `Enroll for ${course.priceCredits} Credits`}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No courses available</h3>
              <p className="text-muted-foreground">Check back later for new courses</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
