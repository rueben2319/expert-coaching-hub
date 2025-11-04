import { useMemo, useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  Save,
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
  const queryClient = useQueryClient();

  // Get localStorage key for this lesson
  const storageKey = `practice-exercises-${lessonId}`;

  // Load saved exercises from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // This will be loaded automatically when data is set
      } catch (err) {
        console.error("Failed to load saved exercises", err);
      }
    }
  }, [storageKey]);

  const {
    generate,
    isLoading,
    isSuccess,
    isError,
    error,
    data,
    reset,
  } = useAIAction({
    onSuccess: (responseData) => {
      // Save to localStorage
      if (responseData?.output) {
        const savedData = {
          output: responseData.output,
          timestamp: new Date().toISOString(),
          params: { difficulty, skillFocus, targetAudience, quantity }
        };
        localStorage.setItem(storageKey, JSON.stringify(savedData));
      }
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

  // Load from localStorage if available and no current data
  useEffect(() => {
    if (!data && !isLoading) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // We can't directly set the data, but we can show a message
        } catch (err) {
          console.error("Failed to load saved exercises", err);
        }
      }
    }
  }, [data, isLoading, storageKey]);

  const parsedResult = useMemo<PracticeExerciseResult | null>(() => {
    // Try to load from current data first
    if (data?.output) {
      try {
        const parsed = JSON.parse(data.output) as PracticeExerciseResult;
        if (parsed?.exercises && Array.isArray(parsed.exercises)) {
          return parsed;
        }
      } catch (err) {
        console.error("Failed to parse practice exercises", err, data.output);
      }
    }
    
    // Fallback to localStorage if no current data
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const savedData = JSON.parse(saved);
        if (savedData?.output) {
          const parsed = JSON.parse(savedData.output) as PracticeExerciseResult;
          if (parsed?.exercises && Array.isArray(parsed.exercises)) {
            return parsed;
          }
        }
      } catch (err) {
        console.error("Failed to parse saved exercises", err);
      }
    }
    
    return null;
  }, [data, storageKey]);

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
    localStorage.removeItem(storageKey);
  };

  const saveToDraft = useMutation({
    mutationFn: async (exercises: PracticeExerciseResult) => {
      // Insert the practice exercise set
      const { data: setData, error: setError } = await supabase
        .from("practice_exercise_sets")
        .insert({
          lesson_id: lessonId,
          difficulty: exercises.set?.difficulty || null,
          skill_focus: exercises.set?.skill_focus || null,
          target_audience: exercises.set?.target_audience || null,
          status: "draft",
        })
        .select()
        .single();

      if (setError) throw setError;
      if (!setData) throw new Error("Failed to create practice set");

      // Insert the practice exercise items
      const items = exercises.exercises.map((ex) => ({
        set_id: setData.id,
        exercise_type: ex.exercise_type,
        question: ex.question,
        answer: ex.answer || null,
        explanation: ex.explanation || null,
        difficulty: ex.difficulty || null,
        tags: ex.tags || null,
        choices: ex.choices || null,
        approved: false,
      }));

      const { error: itemsError } = await supabase
        .from("practice_exercise_items")
        .insert(items);

      if (itemsError) throw itemsError;

      return setData;
    },
    onSuccess: () => {
      toast({
        title: "Saved as draft",
        description: "Your practice exercises are now available in the review panel.",
      });
      localStorage.removeItem(storageKey);
      queryClient.invalidateQueries({ queryKey: ["practice-exercise-sets", lessonId] });
    },
    onError: (error) => {
      console.error("Failed to save draft", error);
      toast({
        title: "Failed to save draft",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveToDraft = () => {
    if (!parsedResult) return;
    saveToDraft.mutate(parsedResult);
  };

  // Load previous result on mount
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);
  useEffect(() => {
    if (!loadedFromStorage && !data) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          toast({
            title: "Previous exercises loaded",
            description: `Loaded exercises from ${new Date(parsed.timestamp).toLocaleDateString()}`,
          });
          setLoadedFromStorage(true);
        } catch (err) {
          console.error("Failed to load saved exercises", err);
        }
      }
    }
  }, [loadedFromStorage, data, storageKey, toast]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <BookOpen className="h-5 w-5 text-indigo-500" />
          Practice Exercise Generator
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Generate draft practice questions tailored to this lesson. Drafts are saved automatically and can
          be reviewed before publishing to learners.
        </p>
      </div>
      <div className="space-y-4 text-sm">
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
          {parsedResult && (
            <>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveToDraft}
                disabled={saveToDraft.isPending}
                className="gap-2"
              >
                {saveToDraft.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving…</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save as Draft</span>
                  </>
                )}
              </Button>
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
              <p className="mt-2 text-xs text-emerald-600 font-medium">
                ✓ Click "Save as Draft" to move these to the review panel for approval.
              </p>
            </div>

            <div className="rounded-lg border max-h-[500px] overflow-y-auto">
              <div className="divide-y">
                {parsedResult.exercises.map((exercise, index) => (
                  <div key={`${exercise.exercise_type}-${index}`} className="space-y-3 p-4 text-sm">
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
                    <p className="font-medium text-foreground leading-relaxed">{exercise.question}</p>
                    {exercise.choices && exercise.choices.length > 0 && (
                      <ul className="space-y-2 rounded-md bg-muted/40 p-3 text-xs">
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
                        <span className="font-medium">Answer: {exercise.answer}</span>
                      </div>
                    )}
                    {exercise.explanation && (
                      <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 p-3 text-xs text-muted-foreground leading-relaxed border border-blue-200 dark:border-blue-900">
                        <p className="font-medium text-blue-900 dark:text-blue-300 mb-1">Explanation:</p>
                        {exercise.explanation}
                      </div>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
