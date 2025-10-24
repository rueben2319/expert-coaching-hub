import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, BookOpen, Users, Edit, Trash2, Search, Clock, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { coachSidebarSections } from "@/config/navigation";

export default function Courses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');

  const { data: courses, isLoading } = useQuery({
    queryKey: ["coach-courses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          *,
          course_modules(
            id,
            lessons(
              estimated_duration
            )
          ),
          course_enrollments(id)
        `)
        .eq("coach_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Calculate total duration and counts for each course
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
          total_duration: totalMinutes,
          // Add count arrays for compatibility
          course_modules: [{ count: course.course_modules?.length || 0 }],
          course_enrollments: [{ count: course.course_enrollments?.length || 0 }]
        };
      });
      
      return coursesWithDuration;
    },
    enabled: !!user?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase
        .from("courses")
        .delete()
        .eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-courses"] });
      toast({ title: "Course deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete course", variant: "destructive" });
    },
  });

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
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(course => course.status === statusFilter);
    }
    
    // Level filter
    if (levelFilter !== 'all') {
      filtered = filtered.filter(course => course.level === levelFilter);
    }
    
    return filtered;
  }, [courses, searchQuery, statusFilter, levelFilter]);

  const handleSearch = (value: string) => {
    setLocalSearch(value);
    if (value) {
      setSearchParams({ search: value });
    } else {
      setSearchParams({});
    }
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
    <DashboardLayout sidebarSections={coachSidebarSections} brandName="Experts Coaching Hub">
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="text-center space-y-4 py-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Manage Your Courses
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Create and manage your courses. Track student progress and engagement.
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search courses..."
              value={localSearch}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-12 pr-4 h-12 text-base rounded-full border-2 focus:border-primary"
            />
          </div>
        </div>

        {/* Filters and Create Button */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-3 w-full sm:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] rounded-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
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

          <Button onClick={() => navigate("/coach/courses/create")} size="lg" className="rounded-full w-full sm:w-auto">
            <Plus className="mr-2 h-5 w-5" />
            Create Course
          </Button>
        </div>

        {/* Results Count */}
        <div className="text-sm text-muted-foreground">
          {filteredCourses.length} result{filteredCourses.length !== 1 ? 's' : ''}
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading courses...</div>
        ) : filteredCourses && filteredCourses.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map((course) => (
              <Card 
                key={course.id} 
                className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/50 cursor-pointer overflow-hidden flex flex-col"
                onClick={() => navigate(`/coach/courses/${course.id}/edit`)}
              >
                <CardHeader className="space-y-3 pb-4 flex-shrink-0">
                  {/* Badges */}
                  <div className="flex gap-2 flex-wrap">
                    <Badge 
                      variant={course.status === "published" ? "default" : "secondary"}
                      className="rounded-full px-3"
                    >
                      {course.status}
                    </Badge>
                    {course.level && (
                      <Badge variant="outline" className="capitalize rounded-full px-3">
                        {course.level}
                      </Badge>
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
                  {/* Meta Info */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap mb-4">
                    {course.total_duration > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        <span>{formatDuration(course.total_duration)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      <span>{course.course_enrollments?.[0]?.count || 0} students</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 group-hover:bg-primary/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/coach/courses/${course.id}/edit`);
                      }}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(course.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="group-hover:bg-primary/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/coach/courses/${course.id}/edit`);
                      }}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first course to get started
              </p>
              <Button onClick={() => navigate("/coach/courses/create")}>
                <Plus className="mr-2 h-4 w-4" />
                Create Course
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
