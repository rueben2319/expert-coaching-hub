import { useNavigate, useSearchParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Clock, Coins, Search, ArrowRight, Signal, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { clientSidebarSections } from "@/config/navigation";
import { useCredits } from "@/hooks/useCredits";
import { CreditWallet } from "@/components/CreditWallet";

export default function Courses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enrollWithCredits, balance } = useCredits();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [priceFilter, setPriceFilter] = useState<string>('all');

  const { data: courses, isLoading } = useQuery({
    queryKey: ["published-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          *,
          course_enrollments!left(*),
          course_modules(
            lessons(
              estimated_duration
            )
          )
        `)
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Calculate total duration for each course
      const coursesWithDuration = data?.map(course => {
        let totalMinutes = 0;
        
        if (course.course_modules) {
          course.course_modules.forEach((module: any) => {
            if (module.lessons) {
              module.lessons.forEach((lesson: any) => {
                totalMinutes += lesson.estimated_duration || 0;
              });
            }
          });
        }
        
        return {
          ...course,
          total_duration: totalMinutes
        };
      });
      
      return coursesWithDuration;
    },
  });

  // Free enrollment mutation (for free courses)
  const enrollMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase
        .from("course_enrollments")
        .insert({
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
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast({ title: "Already enrolled", variant: "destructive" });
      } else {
        toast({ title: "Failed to enroll", variant: "destructive" });
      }
    },
  });

  const isEnrolled = (course: any) => {
    return course.course_enrollments?.some((e: any) => e.user_id === user?.id);
  };

  const handleEnrollClick = (course: any) => {
    if (isEnrolled(course)) {
      navigate(`/client/course/${course.id}`);
      return;
    }

    // Check if course is free or paid
    const isFree = course.is_free || !course.price_credits || course.price_credits === 0;
    
    if (isFree) {
      // Free enrollment
      enrollMutation.mutate(course.id);
    } else {
      // Check if user has enough credits
      if (balance < course.price_credits) {
        toast({ 
          title: "Insufficient credits", 
          description: `You need ${course.price_credits} credits. Buy more credits to enroll.`,
          variant: "destructive" 
        });
        return;
      }
      // Paid enrollment with credits
      enrollWithCredits.mutate(course.id);
    }
  };

  // Filter courses based on search query and filters
  const filteredCourses = useMemo(() => {
    if (!courses) return [];
    
    let filtered = courses;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(course => 
        course.title?.toLowerCase().includes(query) ||
        course.description?.toLowerCase().includes(query) ||
        course.category?.toLowerCase().includes(query) ||
        course.tag?.toLowerCase().includes(query)
      );
    }
    
    // Level filter
    if (levelFilter !== 'all') {
      filtered = filtered.filter(course => course.level === levelFilter);
    }
    
    // Price filter
    if (priceFilter === 'free') {
      filtered = filtered.filter(course => course.is_free || !course.price_credits || course.price_credits === 0);
    } else if (priceFilter === 'paid') {
      filtered = filtered.filter(course => !course.is_free && course.price_credits && course.price_credits > 0);
    }
    
    return filtered;
  }, [courses, searchQuery, levelFilter, priceFilter]);

  const handleSearch = (value: string) => {
    setLocalSearch(value);
    if (value) {
      setSearchParams({ search: value });
    } else {
      setSearchParams({});
    }
  };

  // Level indicator component
  const LevelIndicator = ({ level }: { level?: string }) => {
    if (!level) return null;
    
    const bars = level === 'introduction' ? 1 : level === 'intermediate' ? 2 : 3;
    
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3].map((bar) => (
          <div
            key={bar}
            className={`w-1 rounded-full transition-colors ${
              bar <= bars 
                ? 'bg-primary h-3' 
                : 'bg-muted h-2'
            }`}
          />
        ))}
      </div>
    );
  };

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
    <DashboardLayout sidebarSections={clientSidebarSections}>
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="text-center space-y-4 py-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Discover learning for in-demand skills
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Your home for building AI skills and more. Get hands-on with courses and learn directly from the experts.
          </p>
        </div>

        {/* Search Bar */}
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

        {/* Filters and Credit Wallet */}
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

        {/* Results Count */}
        <div className="text-sm text-muted-foreground">
          {filteredCourses.length} result{filteredCourses.length !== 1 ? 's' : ''}
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading courses...</div>
        ) : filteredCourses && filteredCourses.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map((course) => {
              const enrolled = isEnrolled(course);
              const isFree = course.is_free || !course.price_credits || course.price_credits === 0;
              
              return (
                <Card 
                  key={course.id} 
                  className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/50 cursor-pointer overflow-hidden flex flex-col"
                  onClick={() => enrolled ? navigate(`/client/course/${course.id}`) : handleEnrollClick(course)}
                >
                  <CardHeader className="space-y-3 pb-4 flex-shrink-0">
                    {/* Badges and Level Indicator */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {course.level && <LevelIndicator level={course.level} />}
                      
                      {enrolled ? (
                        <Badge variant="secondary" className="rounded-full px-3">
                          Enrolled
                        </Badge>
                      ) : (
                        <>
                          {isFree ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 rounded-full px-3">
                              Free
                            </Badge>
                          ) : (
                            <Badge className="rounded-full px-3 flex items-center gap-1">
                              <Coins className="h-3 w-3" />
                              {course.price_credits} Credits
                            </Badge>
                          )}
                        </>
                      )}
                    </div>

                    {/* Title */}
                    <CardTitle className="line-clamp-2 text-xl group-hover:text-primary transition-colors">
                      {course.title}
                    </CardTitle>

                    {/* Description */}
                    <CardDescription className="line-clamp-3 text-sm leading-relaxed">
                      {course.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex flex-col flex-grow mt-auto pt-0">
                    {/* Duration */}
                    {course.total_duration > 0 && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
                        <Clock className="h-4 w-4" />
                        <span>{formatDuration(course.total_duration)}</span>
                      </div>
                    )}

                    {/* Action Button */}
                    <div className="flex items-center justify-between mt-auto">
                      {enrolled ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 group-hover:bg-primary/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/client/course/${course.id}`);
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
                            handleEnrollClick(course);
                          }}
                        >
                          {(enrollMutation.isPending || enrollWithCredits.isPending) ? "Enrolling..." : 
                           isFree ? "Enroll Free" : 
                           `Enroll for ${course.price_credits} Credits`}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No courses available</h3>
              <p className="text-muted-foreground">
                Check back later for new courses
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
