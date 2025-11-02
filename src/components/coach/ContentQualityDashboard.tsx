import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, FileText, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useAIAction } from "@/hooks/useAIAction";
import { Skeleton } from "@/components/ui/skeleton";

interface ContentQualityDashboardProps {
  courseId: string;
}

interface ContentItem {
  id: string;
  lessonTitle: string;
  lessonId: string;
  contentType: string;
  contentText: string;
  qualityScore?: number;
}

export function ContentQualityDashboard({ courseId }: ContentQualityDashboardProps) {
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const { generate, data, isLoading, isSuccess, reset } = useAIAction();

  const { data: textContents, isLoading: isLoadingContents } = useQuery({
    queryKey: ["course-text-contents", courseId],
    queryFn: async () => {
      const { data: modules, error } = await supabase
        .from("course_modules")
        .select(`
          id,
          title,
          lessons(
            id,
            title,
            lesson_content(
              id,
              content_type,
              content_data
            )
          )
        `)
        .eq("course_id", courseId)
        .order("order_index", { ascending: true });

      if (error) throw error;

      const items: ContentItem[] = [];
      modules?.forEach((module) => {
        module.lessons?.forEach((lesson: any) => {
          lesson.lesson_content
            ?.filter((content: any) => content.content_type === "text")
            .forEach((content: any) => {
              items.push({
                id: content.id,
                lessonTitle: lesson.title,
                lessonId: lesson.id,
                contentType: content.content_type,
                contentText: content.content_data?.text || content.content_data?.html || "",
              });
            });
        });
      });

      return items;
    },
  });

  const handleAnalyze = async (item: ContentItem) => {
    setAnalyzingId(item.id);
    reset();
    
    await generate({
      actionKey: "content_analyze",
      context: {
        contentId: item.id,
        lessonId: item.lessonId,
        draftText: item.contentText,
      },
    });
  };

  // Update scores when analysis completes
  if (isSuccess && data?.output && analyzingId) {
    try {
      const parsed = JSON.parse(data.output);
      if (parsed.scores?.overall) {
        setScores((prev) => ({ ...prev, [analyzingId]: parsed.scores.overall }));
        setAnalyzingId(null);
      }
    } catch {
      setAnalyzingId(null);
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600";
    if (score >= 6) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 8) return "Excellent";
    if (score >= 6) return "Good";
    if (score >= 4) return "Needs Work";
    return "Poor";
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 8) return "default";
    if (score >= 6) return "secondary";
    return "destructive";
  };

  if (isLoadingContents) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Content Quality Dashboard
          </CardTitle>
          <CardDescription>Loading content analysis...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!textContents || textContents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Content Quality Dashboard
          </CardTitle>
          <CardDescription>AI-powered quality analysis for all text content</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No text content found in this course.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Add text content to lessons to see quality analysis.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const analyzedCount = Object.keys(scores).length;
  const totalCount = textContents.length;
  const averageScore =
    analyzedCount > 0
      ? Object.values(scores).reduce((sum, score) => sum + score, 0) / analyzedCount
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          Content Quality Dashboard
        </CardTitle>
        <CardDescription>AI-powered quality analysis for all text content</CardDescription>
        
        {analyzedCount > 0 && (
          <div className="mt-4 p-4 rounded-lg bg-muted/30">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{analyzedCount}/{totalCount}</div>
                <div className="text-xs text-muted-foreground mt-1">Analyzed</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${getScoreColor(averageScore)}`}>
                  {averageScore.toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Avg Score</div>
              </div>
              <div>
                <Badge variant={getScoreBadgeVariant(averageScore)} className="mt-1">
                  {getScoreLabel(averageScore)}
                </Badge>
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {textContents.map((item) => {
          const score = scores[item.id];
          const isAnalyzing = analyzingId === item.id && isLoading;

          return (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <h4 className="font-medium text-sm truncate">{item.lessonTitle}</h4>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {item.contentText.substring(0, 100)}...
                </p>
              </div>
              
              <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                {score !== undefined ? (
                  <div className="text-center min-w-[80px]">
                    <div className={`text-xl font-bold ${getScoreColor(score)}`}>
                      {score.toFixed(1)}
                    </div>
                    <Progress value={score * 10} className="h-1 w-full mt-1" />
                  </div>
                ) : (
                  <div className="min-w-[80px]">
                    <Badge variant="outline" className="text-xs">
                      Not analyzed
                    </Badge>
                  </div>
                )}
                
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleAnalyze(item)}
                  disabled={isAnalyzing}
                  className="gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <Sparkles className="h-4 w-4 animate-pulse" />
                      Analyzing...
                    </>
                  ) : score !== undefined ? (
                    <>
                      <TrendingUp className="h-4 w-4" />
                      Re-analyze
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Analyze
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
