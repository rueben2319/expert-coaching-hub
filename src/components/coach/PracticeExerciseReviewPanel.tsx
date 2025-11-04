import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type { PostgrestError } from "@supabase/supabase-js";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, CheckCircle2, ShieldAlert } from "lucide-react";

type PracticeExerciseSet = Database["public"]["Tables"]["practice_exercise_sets"]["Row"];
type PracticeExerciseItem = Database["public"]["Tables"]["practice_exercise_items"]["Row"];

type PracticeExerciseSetWithItems = PracticeExerciseSet & {
  practice_exercise_items: PracticeExerciseItem[];
};

interface PracticeExerciseReviewPanelProps {
  lessonId: string;
}

interface PracticeExerciseItemCardProps {
  item: PracticeExerciseItem;
  onToggleApproved: (approved: boolean) => void;
  disableApprovalToggle: boolean;
  onSave: (payload: Partial<PracticeExerciseItem>) => void;
  isSaving: boolean;
}

const difficultyOptions = ["intro", "intermediate", "advanced"];

function PracticeExerciseItemCard({
  item,
  onToggleApproved,
  disableApprovalToggle,
  onSave,
  isSaving,
}: PracticeExerciseItemCardProps) {
  const [question, setQuestion] = useState(item.question);
  const [answer, setAnswer] = useState(item.answer ?? "");
  const [explanation, setExplanation] = useState(item.explanation ?? "");
  const [difficulty, setDifficulty] = useState(item.difficulty ?? "");
  const [tagsInput, setTagsInput] = useState(item.tags?.join(", ") ?? "");

  const choiceOptions = useMemo(() => {
    if (!Array.isArray(item.choices)) return [] as string[];
    return item.choices.filter((choice): choice is string => typeof choice === "string");
  }, [item.choices]);

  useEffect(() => {
    setQuestion(item.question);
    setAnswer(item.answer ?? "");
    setExplanation(item.explanation ?? "");
    setDifficulty(item.difficulty ?? "");
    setTagsInput(item.tags?.join(", ") ?? "");
  }, [item]);

  const hasChanges =
    question !== item.question ||
    (answer ?? "") !== (item.answer ?? "") ||
    (explanation ?? "") !== (item.explanation ?? "") ||
    (difficulty ?? "") !== (item.difficulty ?? "") ||
    tagsInput !== (item.tags?.join(", ") ?? "");

  const handleSave = () => {
    const processedTags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const payload: Partial<PracticeExerciseItem> = {
      question,
      answer: answer.trim() ? answer.trim() : null,
      explanation: explanation.trim() ? explanation.trim() : null,
      difficulty: difficulty.trim() ? difficulty.trim() : null,
      tags: processedTags.length ? processedTags : null,
    };

    onSave(payload);
  };

  const handleReset = () => {
    setQuestion(item.question);
    setAnswer(item.answer ?? "");
    setExplanation(item.explanation ?? "");
    setDifficulty(item.difficulty ?? "");
    setTagsInput(item.tags?.join(", ") ?? "");
  };

  return (
    <div className="space-y-3 py-3 border-b last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline" className="capitalize">
            {item.exercise_type.replace(/_/g, " ")}
          </Badge>
          {item.difficulty && (
            <Badge variant="secondary" className="uppercase">
              {item.difficulty}
            </Badge>
          )}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px] uppercase tracking-wide">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Approved</span>
          <Switch
            checked={item.approved}
            onCheckedChange={onToggleApproved}
            disabled={disableApprovalToggle}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium">Question</label>
        <Textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={3}
        />
      </div>

      {choiceOptions.length > 0 && (
        <div className="space-y-2 text-xs">
          <p className="font-medium text-muted-foreground">Choices</p>
          <ul className="ml-5 list-disc space-y-1 text-muted-foreground">
            {choiceOptions.map((choice, index) => (
              <li key={`${item.id}-choice-${index}`}>
                {String.fromCharCode(65 + index)}. {choice}
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-muted-foreground">
            Choice editing coming soon. Edit answers/explanations below.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-medium">Difficulty</label>
          <Input
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
            list={`difficulty-options-${item.id}`}
          />
          <datalist id={`difficulty-options-${item.id}`}>
            {difficultyOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium">Tags (comma separated)</label>
          <Input value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium">Answer</label>
        <Input value={answer} onChange={(event) => setAnswer(event.target.value)} />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium">Explanation</label>
        <Textarea
          value={explanation}
          onChange={(event) => setExplanation(event.target.value)}
          rows={3}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="gap-2"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Save changes
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={handleReset} disabled={!hasChanges || isSaving}>
          Reset
        </Button>
      </div>
    </div>
  );
}

const statusLabels: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-amber-100 text-amber-800" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Rejected", className: "bg-rose-100 text-rose-800" },
};

async function fetchPracticeSets(lessonId: string): Promise<PracticeExerciseSetWithItems[]> {
  const { data, error } = await supabase
    .from("practice_exercise_sets")
    .select("*, practice_exercise_items(*)")
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load practice exercise sets", error);
    throw error;
  }

  const typedData = (data ?? []) as (PracticeExerciseSet & {
    practice_exercise_items: (PracticeExerciseItem & { tags: Json | null })[] | null;
  })[];

  return typedData.map((set) => ({
    ...set,
    practice_exercise_items: (set.practice_exercise_items ?? []).map((item) => ({
      ...item,
      tags: Array.isArray(item.tags)
        ? item.tags.filter((tag): tag is string => typeof tag === "string")
        : null,
    })),
  })) as PracticeExerciseSetWithItems[];
}

export function PracticeExerciseReviewPanel({ lessonId }: PracticeExerciseReviewPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: practiceSets,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["practice-exercise-sets", lessonId],
    queryFn: () => fetchPracticeSets(lessonId),
    enabled: Boolean(lessonId),
  });

  const friendlyErrorMessage = useMemo(() => {
    if (!error) return null;
    const postgrestError = error as PostgrestError;

    if (postgrestError.code === "42P17") {
      return {
        title: "Migration required",
        description:
          "Practice exercise policies need to be updated. Run the latest Supabase migration (20251101130501_fix_practice_exercise_rls.sql) and redeploy to continue.",
      };
    }

    return {
      title: "Failed to load practice sets",
      description: postgrestError.message ?? "Unexpected error fetching practice exercises.",
    };
  }, [error]);

  const updateSetStatus = useMutation({
    mutationFn: async ({
      setId,
      status,
    }: {
      setId: string;
      status: PracticeExerciseSet["status"];
    }) => {
      const updates: Partial<PracticeExerciseSet> = {
        status,
        approved_at: status === "approved" ? new Date().toISOString() : null,
      };

      const { error: setError } = await supabase
        .from("practice_exercise_sets")
        .update(updates)
        .eq("id", setId);

      if (setError) throw setError;

      const { error: itemsError } = await supabase
        .from("practice_exercise_items")
        .update({ approved: status === "approved" })
        .eq("set_id", setId);

      if (itemsError) throw itemsError;
    },
    onSuccess: (_data, variables) => {
      const statusLabel = statusLabels[variables.status]?.label ?? variables.status ?? "updated";
      toast({
        title: `Practice set status updated to ${statusLabel}`,
        description: "Changes saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["practice-exercise-sets", lessonId] });
    },
    onError: (mutationError) => {
      console.error("Failed to update practice set status", mutationError);
      toast({
        title: "Could not update practice set",
        description: mutationError instanceof Error ? mutationError.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateItemDetails = useMutation<
    void,
    unknown,
    { itemId: string; payload: Partial<PracticeExerciseItem> }
  >({
    mutationFn: async ({ itemId, payload }) => {
      const { error: itemError } = await supabase
        .from("practice_exercise_items")
        .update(payload)
        .eq("id", itemId);

      if (itemError) throw itemError;
    },
    onSuccess: () => {
      toast({
        title: "Practice item updated",
        description: "Your edits were saved.",
      });
      queryClient.invalidateQueries({ queryKey: ["practice-exercise-sets", lessonId] });
    },
    onError: (mutationError) => {
      console.error("Failed to update practice item", mutationError);
      toast({
        title: "Could not update practice item",
        description: mutationError instanceof Error ? mutationError.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateItemApproval = useMutation({
    mutationFn: async ({ itemId, approved }: { itemId: string; approved: boolean }) => {
      const { error: itemError } = await supabase
        .from("practice_exercise_items")
        .update({ approved })
        .eq("id", itemId);

      if (itemError) throw itemError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practice-exercise-sets", lessonId] });
    },
    onError: (mutationError) => {
      console.error("Failed to update practice item approval", mutationError);
      toast({
        title: "Could not update practice item",
        description: mutationError instanceof Error ? mutationError.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const sortedSets = useMemo(() => {
    if (!practiceSets) return [];
    return [...practiceSets].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [practiceSets]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-indigo-500" />
            Practice Drafts
          </h3>
          <p className="text-sm text-muted-foreground">
            Review and approve generated practice sets before publishing them to learners.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="gap-2 shrink-0"
        >
          <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      </div>
      <div className="space-y-4 text-sm">
        {isError && friendlyErrorMessage && (
          <Alert variant="destructive">
            <AlertDescription className="space-y-1">
              <p className="font-medium text-sm">{friendlyErrorMessage.title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {friendlyErrorMessage.description}
              </p>
            </AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading practice drafts…</span>
          </div>
        )}

        {!isLoading && !sortedSets.length && (
          <div className="rounded-lg border border-dashed border-muted p-4 text-muted-foreground text-sm">
            No practice drafts yet. Generate exercises to review them here.
          </div>
        )}

        {sortedSets.length > 0 && (
          <div className="space-y-4">
              {sortedSets.map((set) => {
                const statusMeta = statusLabels[set.status] ?? {
                  label: set.status ?? "Unknown",
                  className: "bg-muted text-foreground",
                };
                return (
                  <div key={set.id} className="space-y-4 pb-6 border-b last:border-b-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={`${statusMeta.className} capitalize`}>{statusMeta.label}</Badge>
                          {set.difficulty && (
                            <Badge variant="outline" className="uppercase tracking-wide">
                              {set.difficulty}
                            </Badge>
                          )}
                          {set.skill_focus && <Badge variant="secondary">{set.skill_focus}</Badge>}
                          {set.target_audience && (
                            <Badge variant="secondary">Audience: {set.target_audience}</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Generated on {new Date(set.created_at).toLocaleString()} • {set.practice_exercise_items.length} items
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {set.status !== "approved" && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => updateSetStatus.mutate({ setId: set.id, status: "approved" })}
                            disabled={updateSetStatus.isPending}
                          >
                            Approve
                          </Button>
                        )}
                        {set.status !== "rejected" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => updateSetStatus.mutate({ setId: set.id, status: "rejected" })}
                            disabled={updateSetStatus.isPending}
                          >
                            Reject
                          </Button>
                        )}
                        {set.status !== "draft" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => updateSetStatus.mutate({ setId: set.id, status: "draft" })}
                            disabled={updateSetStatus.isPending}
                          >
                            Mark as Draft
                          </Button>
                        )}
                      </div>
                    </div>

                    {set.prompt_context && (
                      <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                        <strong className="text-foreground">Context:</strong> {JSON.stringify(set.prompt_context, null, 2)}
                      </div>
                    )}

                    <div className="space-y-4 mt-4">
                      {set.practice_exercise_items.map((item) => (
                        <PracticeExerciseItemCard
                          key={item.id}
                          item={item}
                          onToggleApproved={(approved) =>
                            updateItemApproval.mutate({ itemId: item.id, approved })
                          }
                          disableApprovalToggle={updateItemApproval.isPending}
                          onSave={(payload) =>
                            updateItemDetails.mutate({ itemId: item.id, payload })
                          }
                          isSaving={
                            updateItemDetails.isPending &&
                            updateItemDetails.variables?.itemId === item.id
                          }
                        />
                      ))}
                      {set.practice_exercise_items.length === 0 && (
                        <div className="flex items-center gap-2 rounded-md border border-dashed border-muted p-3 text-xs text-muted-foreground">
                          <ShieldAlert className="h-4 w-4" />
                          <span>No exercise items were saved for this set.</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
