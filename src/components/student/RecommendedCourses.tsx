import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, BookOpen, TrendingUp, ArrowRight } from "lucide-react";
import { useAIAction } from "@/hooks/useAIAction";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface CourseRecommendation {
  course_id: string;
  reason: string;
}

interface RecommendationsResponse {
  recommendations: CourseRecommendation[];
}

export function RecommendedCourses() {
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<CourseRecommendation[]>([]);
  
  const { generate, data, isLoading, isSuccess } = useAIAction();

  // Fetch course details for recommendations
  const { data: coursesData } = useQuery({
    queryKey: ["recommended-courses", recommendations],
    queryFn: async () => {
      if (recommendations.length === 0) return [];
      
      const courseIds = recommendations.map(r => r.course_id);
      const { data, error } = await supabase
        .from("courses")
        .select(`
          id,
          title,
          description,
          category,
          level,
          tags,
          thumbnail_url,
          coach_id,
          profiles!courses_coach_id_fkey (
            full_name
          )
        `)
        .in("id", courseIds);

      if (error) throw error;
      
      // Merge with recommendation reasons
      return data?.map(course => ({
        ...course,
        reason: recommendations.find(r => r.course_id === course.id)?.reason || "",
      }));
    },
    enabled: recommendations.length > 0,
  });

  const handleGenerateRecommendations = () => {
    generate({
      actionKey: "course_recommend",
      context: {},
    });
  };

  // Parse AI response when successful
  useEffect(() => {
    if (isSuccess && data?.output) {
      try {
        const parsed: RecommendationsResponse = JSON.parse(data.output);
        setRecommendations(parsed.recommendations || []);
      } catch (error) {
        console.error("Failed to parse recommendations:", error);
      }
    }
  }, [isSuccess, data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-purple-600" />
          Recommended for You
        </CardTitle>
        <CardDescription>
          AI-powered course recommendations based on your learning journey
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isSuccess && (
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-purple-600 opacity-50" />
            <p className="text-muted-foreground mb-4">
              Discover courses tailored to your interests and learning goals
            </p>
            <Button
              onClick={handleGenerateRecommendations}
              disabled={isLoading}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Finding Courses...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Get Recommendations
                </>
              )}
            </Button>
          </div>
        )}

        {isSuccess && coursesData && coursesData.length > 0 && (
          <div className="space-y-4">
            {coursesData.map((course: any) => (
              <Card key={course.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    {course.thumbnail_url ? (
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        className="w-24 h-24 object-cover rounded-md"
                      />
                    ) : (
                      <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900 dark:to-blue-900 rounded-md flex items-center justify-center">
                        <BookOpen className="h-8 w-8 text-purple-600" />
                      </div>
                    )}

                    {/* Course Info */}
                    <div className="flex-1 space-y-2">
                      <div>
                        <h3 className="font-semibold text-lg">{course.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {course.description}
                        </p>
                      </div>

                      {/* AI Recommendation Reason */}
                      <div className="bg-purple-50 dark:bg-purple-950/30 p-2 rounded-md border border-purple-200 dark:border-purple-800">
                        <p className="text-sm text-purple-900 dark:text-purple-100 flex items-start gap-2">
                          <Sparkles className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{course.reason}</span>
                        </p>
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {course.category && (
                          <Badge variant="secondary">{course.category}</Badge>
                        )}
                        {course.level && (
                          <Badge variant="outline">{course.level}</Badge>
                        )}
                        {course.profiles?.full_name && (
                          <span className="text-xs text-muted-foreground">
                            by {course.profiles.full_name}
                          </span>
                        )}
                      </div>

                      {/* View Course Button */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/client/courses/${course.id}`)}
                        className="mt-2"
                      >
                        View Course
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Regenerate Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerateRecommendations}
              disabled={isLoading}
              className="w-full"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Get More Recommendations
            </Button>
          </div>
        )}

        {isSuccess && (!coursesData || coursesData.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No recommendations available at the moment.</p>
            <p className="text-sm mt-2">Enroll in more courses to get personalized suggestions!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
