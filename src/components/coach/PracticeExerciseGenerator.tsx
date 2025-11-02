import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAIAction } from "@/hooks/useAIAction";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  RefreshCw,
  Sparkles,
  ListChecks,
  CheckCircle2,
  BookOpen,
} from "lucide-react";

interface PracticeExerciseGeneratorProps {
  lessonId: string;
  contentId?: string;
}

interface PracticeExerciseResult {
  set?: {
    difficulty?: string;
    skill_focus?: string;
    target_audience?: string;
    summary?: string;
  };
  exercises: Array<{
    exercise_type: string;
    question: string;
    answer?: string;
    explanation?: string;
    difficulty?: string;
    tags?: string[];
    choices?: string[];
  }>;
}

const difficultyOptions: Array<{ value: string; label: string }> = [
  { value: "intro", label: "Introductory" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

export function PracticeExerciseGenerator({ lessonId, contentId }: PracticeExerciseGeneratorProps) {
  const [difficulty, setDifficulty] = useState<string | undefined>();
  const [skillFocus, setSkillFocus] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [quantity, setQuantity] = useState(6);
  const { toast } = useToast();

  const {
    generate,
    isLoading,
    isSuccess,
    isError,
    error,
    data,
    reset,
  } = useAIAction({
    onSuccess: () => {
      toast({
        title: "Practice draft generated",
        description: "A draft practice set has been saved as a draft for this lesson.",
      });
    },
    onError: (err) => {
      toast({
        title: "Unable to generate practice",
        description: err?.message ?? "Please try again in a moment.",
        variant: "destructive",
      });
    },
  });

  const parsedResult = useMemo<PracticeExerciseResult | null>(() => {
    if (!data?.output) return null;
    try {
      const parsed = JSON.parse(data.output) as PracticeExerciseResult;
      if (!parsed?.exercises || !Array.isArray(parsed.exercises)) {
        return null;
      }
      return parsed;
    } catch (err) {
      console.error("Failed to parse practice exercises", err, data.output);
      return null;
    }
  }, [data]);

  const handleGenerate = () => {
    const context: Record<string, unknown> = {
      lessonId,
      quantity,
    };
    if (contentId) context.contentId = contentId;
    if (difficulty) context.difficulty = difficulty;
    if (skillFocus.trim()) context.skillFocus = skillFocus.trim();
    if (targetAudience.trim()) context.targetAudience = targetAudience.trim();

    generate({
      actionKey: "practice_exercise_generate",
      context,
    });
  };

  const handleReset = () => {
    reset();
  };

  return (
    <Card className="shadow-none border-muted">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4 text-indigo-500" />
          Practice Exercise Generator
        </CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          Generate draft practice questions tailored to this lesson. Drafts are saved automatically and can
          be reviewed before publishing to learners.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label className="text-xs uppercase tracking-wide">Difficulty</Label>
            <Select
              value={difficulty ?? "auto"}
              onValueChange={(value) => {
                if (value === "auto") {
                  setDifficulty(undefined);
                } else {
                  setDifficulty(value);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Auto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                {difficultyOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs uppercase tracking-wide">Skill focus</Label>
            <Input
              value={skillFocus}
              onChange={(event) => setSkillFocus(event.target.value)}
              placeholder="e.g. Critical thinking, reflection"
              className="h-9"
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-xs uppercase tracking-wide">Target audience</Label>
            <Input
              value={targetAudience}
              onChange={(event) => setTargetAudience(event.target.value)}
              placeholder="e.g. Beginner professionals"
              className="h-9"
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-xs uppercase tracking-wide">Quantity</Label>
            <Input
              type="number"
              min={3}
              max={12}
              value={quantity}
              onChange={(event) => {
                const value = parseInt(event.target.value, 10);
                if (Number.isNaN(value)) {
                  setQuantity(6);
                  return;
                }
                setQuantity(Math.max(3, Math.min(12, value)));
              }}
              className="h-9"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="button" size="sm" onClick={handleGenerate} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating…</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Generate Practice</span>
              </>
            )}
          </Button>
          {isSuccess && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={handleGenerate}
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={isLoading}
              >
                Clear
              </Button>
            </>
          )}
        </div>

        {isError && (
          <Alert variant="destructive">
            <AlertDescription>{error?.message ?? "Could not generate practice items."}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Crafting personalised practice…</span>
          </div>
        )}

        {!isLoading && !parsedResult && !isSuccess && (
          <div className="flex items-start gap-3 rounded-lg border border-dashed border-muted p-3 text-muted-foreground">
            <ListChecks className="mt-1 h-4 w-4" />
            <p className="text-xs leading-relaxed">
              Choose optional parameters and generate a tailored set of practice exercises for this lesson.
              Drafts remain private until you approve them.
            </p>
          </div>
        )}

        {parsedResult && (
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {parsedResult.set?.difficulty && (
                  <Badge variant="outline" className="uppercase tracking-wide">
                    {parsedResult.set.difficulty}
                  </Badge>
                )}
                {parsedResult.set?.skill_focus && (
                  <Badge variant="secondary">{parsedResult.set.skill_focus}</Badge>
                )}
                {parsedResult.set?.target_audience && (
                  <Badge variant="secondary">Audience: {parsedResult.set.target_audience}</Badge>
                )}
              </div>
              {parsedResult.set?.summary && (
                <p className="mt-2 text-xs text-muted-foreground">{parsedResult.set.summary}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Saved as draft. Approve from the practice exercises list when you are ready to publish.
              </p>
            </div>

            <ScrollArea className="max-h-[360px] rounded-lg border">
              <div className="divide-y">
                {parsedResult.exercises.map((exercise, index) => (
                  <div key={`${exercise.exercise_type}-${index}`} className="space-y-3 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-medium">
                        <Badge variant="outline" className="capitalize">
                          {exercise.exercise_type.replace(/_/g, " ")}
                        </Badge>
                        {exercise.difficulty && (
                          <Badge variant="secondary" className="uppercase">
                            {exercise.difficulty}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">Question {index + 1}</span>
                    </div>
                    <p className="font-medium text-foreground">{exercise.question}</p>
                    {exercise.choices && exercise.choices.length > 0 && (
                      <ul className="space-y-1 rounded-md bg-muted/40 p-3 text-xs">
                        {exercise.choices.map((choice, choiceIndex) => {
                          const isAnswer = exercise.answer && exercise.answer.trim().length > 0 && choice.trim().toLowerCase() === exercise.answer.trim().toLowerCase();
                          return (
                            <li
                              key={choiceIndex}
                              className={isAnswer ? "font-semibold text-emerald-600" : "text-muted-foreground"}
                            >
                              {String.fromCharCode(65 + choiceIndex)}. {choice}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {exercise.answer && (
                      <div className="flex items-center gap-2 text-xs text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Answer: {exercise.answer}</span>
                      </div>
                    )}
                    {exercise.explanation && (
                      <p className="text-xs text-muted-foreground">{exercise.explanation}</p>
                    )}
                    {exercise.tags && exercise.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {exercise.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px] uppercase tracking-wide">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
