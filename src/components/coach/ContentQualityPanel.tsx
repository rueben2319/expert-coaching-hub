import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Loader2, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Info,
  TrendingUp,
  BookOpen,
  Users,
  Layout,
  Eye
} from "lucide-react";
import { useAIAction } from "@/hooks/useAIAction";

interface ContentQualityPanelProps {
  contentId?: string;
  lessonId?: string;
  draftText?: string;
  contentTitle?: string;
}

interface QualityScores {
  readability: number;
  completeness: number;
  engagement: number;
  structure: number;
  accessibility: number;
  overall: number;
}

interface Improvement {
  category: string;
  suggestion: string;
  priority: "high" | "medium" | "low";
}

interface QualityAnalysis {
  scores: QualityScores;
  improvements: Improvement[];
  missing_elements: string[];
  strengths: string[];
}

export function ContentQualityPanel({ contentId, lessonId, draftText, contentTitle }: ContentQualityPanelProps) {
  const [analysis, setAnalysis] = useState<QualityAnalysis | null>(null);
  const { generate, data, isLoading, isSuccess, isError, reset } = useAIAction();

  const hasAnalyzableContent = Boolean(
    contentId || (draftText && draftText.trim().length >= 100)
  );

  const handleAnalyze = () => {
    if (!hasAnalyzableContent) return;

    reset();
    const contextPayload: Record<string, string> = {};
    if (contentId) contextPayload.contentId = contentId;
    if (lessonId) contextPayload.lessonId = lessonId;
    if (draftText) contextPayload.draftText = draftText;

    generate({
      actionKey: "content_analyze",
      context: contextPayload,
    });
  };

  useEffect(() => {
    if (isSuccess && data?.output) {
      try {
        const parsed: QualityAnalysis = JSON.parse(data.output);
        setAnalysis(parsed);
      } catch (error) {
        console.error("Failed to parse quality analysis:", error);
      }
    }
  }, [isSuccess, data]);

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

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "high":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case "medium":
        return <Info className="h-4 w-4 text-yellow-600" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-blue-600" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, any> = {
      high: "destructive",
      medium: "default",
      low: "secondary",
    };
    return variants[priority] || "secondary";
  };

  const scoreIcons = {
    readability: BookOpen,
    completeness: CheckCircle2,
    engagement: TrendingUp,
    structure: Layout,
    accessibility: Users,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          Content Quality Analysis
        </CardTitle>
        <CardDescription>
          AI-powered analysis of "{contentTitle}"
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!analysis && !isLoading && (
          <div className="text-center py-8">
            <Eye className="h-12 w-12 mx-auto mb-4 text-purple-600 opacity-50" />
            <p className="text-muted-foreground mb-4">
              Get AI-powered insights to improve your content quality
            </p>
            <Button
              type="button"
              onClick={handleAnalyze}
              disabled={isLoading || !hasAnalyzableContent}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Analyze Content
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-600" />
            <p className="text-muted-foreground">Analyzing content quality...</p>
          </div>
        )}

        {isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to analyze content. Please try again.
            </AlertDescription>
          </Alert>
        )}

        {analysis && (
          <div className="space-y-6">
            {/* Overall Score */}
            <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 rounded-lg">
              <div className={`text-5xl font-bold ${getScoreColor(analysis.scores.overall)}`}>
                {analysis.scores.overall.toFixed(1)}
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                Overall Quality Score
              </div>
              <Badge className="mt-2" variant="outline">
                {getScoreLabel(analysis.scores.overall)}
              </Badge>
            </div>

            {/* Individual Scores */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Detailed Scores</h3>
              {Object.entries(analysis.scores).map(([key, value]) => {
                if (key === "overall") return null;
                const Icon = scoreIcons[key as keyof typeof scoreIcons];
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {Icon && <Icon className="h-4 w-4" />}
                        <span className="capitalize">{key}</span>
                      </div>
                      <span className={`font-semibold ${getScoreColor(value)}`}>
                        {value.toFixed(1)}/10
                      </span>
                    </div>
                    <Progress value={value * 10} className="h-2" />
                  </div>
                );
              })}
            </div>

            {/* Strengths */}
            {analysis.strengths.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Strengths
                </h3>
                <div className="space-y-2">
                  {analysis.strengths.map((strength, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-md border border-green-200 dark:border-green-800"
                    >
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-green-900 dark:text-green-100">{strength}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Improvements */}
            {analysis.improvements.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  Suggested Improvements
                </h3>
                <div className="space-y-3">
                  {analysis.improvements.map((improvement, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {getPriorityIcon(improvement.priority)}
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{improvement.category}</span>
                              <Badge variant={getPriorityBadge(improvement.priority)} className="text-xs">
                                {improvement.priority}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {improvement.suggestion}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Missing Elements */}
            {analysis.missing_elements.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  Missing Elements
                </h3>
                <div className="space-y-2">
                  {analysis.missing_elements.map((element, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-md border border-orange-200 dark:border-orange-800"
                    >
                      <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-orange-900 dark:text-orange-100">{element}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Re-analyze Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setAnalysis(null);
                handleAnalyze();
              }}
              disabled={isLoading || !hasAnalyzableContent}
              className="w-full"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Re-analyze Content
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
