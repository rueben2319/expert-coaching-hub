import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Sparkles, BookOpen, Target, Lightbulb, CheckCircle2, StickyNote, X } from "lucide-react";
import { useAIAction } from "@/hooks/useAIAction";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AIStudyBuddyProps {
  lessonId: string;
  lessonTitle: string;
}

interface LessonSummary {
  summary: string;
  keyConcepts: string[];
  learningObjectives: string[];
  keyTakeaways: string[];
  suggestedActions: string[];
}

export function AIStudyBuddy({ lessonId, lessonTitle }: AIStudyBuddyProps) {
  const [userNote, setUserNote] = useState("");
  const queryClient = useQueryClient();

  const { generate, data, isLoading, isSuccess, isError, error } = useAIAction();

  const handleGenerateSummary = () => {
    generate({
      actionKey: "lesson_summarize",
      context: { lessonId },
    });
  };

  const saveNoteMutation = useMutation({
    mutationFn: async (noteData: { note_text: string; ai_summary?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("client_notes")
        .insert({
          note_text: noteData.note_text,
          ai_summary: noteData.ai_summary,
          is_ai_generated: false,
          lesson_id: lessonId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Note saved!",
        description: "Your note has been saved successfully.",
      });
      setUserNote("");
      queryClient.invalidateQueries({ queryKey: ["client-notes", lessonId] });
    },
    onError: (error) => {
      toast({
        title: "Failed to save note",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveNote = () => {
    if (!userNote.trim()) {
      toast({
        title: "Note is empty",
        description: "Please write something before saving.",
        variant: "destructive",
      });
      return;
    }

    const aiSummary = isSuccess && data?.output ? data.output : undefined;
    saveNoteMutation.mutate({
      note_text: userNote,
      ai_summary: aiSummary,
    });
  };

  const parsedSummary: LessonSummary | null = (() => {
    if (!isSuccess || !data?.output) return null;
    try {
      return JSON.parse(data.output);
    } catch {
      return null;
    }
  })();

  return (
    <>
      {/* Floating Action Button */}
      <Dialog>
        <DialogTrigger asChild>
          <Button
            size="lg"
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 hover:scale-110 transition-all duration-300 z-50 p-0 animate-pulse"
            title="AI Study Buddy - Get help with this lesson"
          >
            <Sparkles className="h-6 w-6 text-white" />
          </Button>
        </DialogTrigger>
        
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden p-0">
          <DialogHeader className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 p-6 pb-4">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-6 w-6 text-purple-600" />
              AI Study Buddy
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Get AI-powered summaries and take notes for {lessonTitle}
            </p>
          </DialogHeader>
          
          <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(85vh-120px)]">
        {/* Generate Summary Button */}
        <div>
          <Button
            type="button"
            onClick={handleGenerateSummary}
            disabled={isLoading}
            className="w-full"
            variant="outline"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating Summary...
              </>
            ) : (
              <>
                <BookOpen className="h-4 w-4 mr-2" />
                Generate Lesson Summary
              </>
            )}
          </Button>
        </div>

        {/* Error State */}
        {isError && (
          <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/50 rounded-md p-3">
            {error?.message ?? "Failed to generate summary. Please try again."}
          </div>
        )}

        {/* Summary Display */}
        {isSuccess && parsedSummary && (
          <ScrollArea className="h-[400px] rounded-md border p-4">
            <div className="space-y-4">
              {/* Overview */}
              <div>
                <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                  <BookOpen className="h-4 w-4 text-purple-600" />
                  Overview
                </h4>
                <p className="text-sm text-muted-foreground">{parsedSummary.summary}</p>
              </div>

              {/* Key Concepts */}
              {parsedSummary.keyConcepts.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-yellow-600" />
                    Key Concepts
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {parsedSummary.keyConcepts.map((concept, idx) => (
                      <li key={idx}>{concept}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Learning Objectives */}
              {parsedSummary.learningObjectives.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-blue-600" />
                    Learning Objectives
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {parsedSummary.learningObjectives.map((objective, idx) => (
                      <li key={idx}>{objective}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Key Takeaways */}
              {parsedSummary.keyTakeaways.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Key Takeaways
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {parsedSummary.keyTakeaways.map((takeaway, idx) => (
                      <li key={idx}>{takeaway}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggested Actions */}
              {parsedSummary.suggestedActions.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                    <StickyNote className="h-4 w-4 text-orange-600" />
                    Suggested Study Actions
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {parsedSummary.suggestedActions.map((action, idx) => (
                      <li key={idx}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Note Taking */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <StickyNote className="h-4 w-4" />
            Your Notes
          </label>
          <Textarea
            placeholder="Write your notes about this lesson..."
            value={userNote}
            onChange={(e) => setUserNote(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <Button
            type="button"
            onClick={handleSaveNote}
            disabled={saveNoteMutation.isPending || !userNote.trim()}
            className="w-full"
          >
            {saveNoteMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <StickyNote className="h-4 w-4 mr-2" />
                Save Note
              </>
            )}
          </Button>
        </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
