import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CoachAIAside } from "@/components/ai/CoachAIAside";
import { ScrollArea } from "@/components/ui/scroll-area";

const lessonSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(1000).optional(),
  estimated_duration: z.coerce.number().min(1).max(1000).optional(),
});

type LessonFormData = z.infer<typeof lessonSchema>;

interface CreateLessonDialogProps {
  moduleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editLesson?: any;
}

export function CreateLessonDialog({ moduleId, open, onOpenChange, editLesson }: CreateLessonDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!editLesson;

  const { data: lessonCount } = useQuery({
    queryKey: ["lesson-count", moduleId],
    queryFn: async () => {
      const { count } = await supabase
        .from("lessons")
        .select("*", { count: "exact", head: true })
        .eq("module_id", moduleId);
      return count || 0;
    },
    enabled: !isEditing,
  });

  const form = useForm<LessonFormData>({
    resolver: zodResolver(lessonSchema),
    defaultValues: {
      title: editLesson?.title || "",
      description: editLesson?.description || "",
      estimated_duration: editLesson?.estimated_duration || undefined,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: LessonFormData) => {
      if (isEditing) {
        const { error } = await supabase
          .from("lessons")
          .update({
            title: data.title,
            description: data.description || null,
            estimated_duration: data.estimated_duration || null,
          })
          .eq("id", editLesson.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lessons").insert({
          module_id: moduleId,
          title: data.title,
          description: data.description || null,
          estimated_duration: data.estimated_duration || null,
          order_index: lessonCount || 0,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-modules"] });
      toast({ title: isEditing ? "Lesson updated successfully" : "Lesson created successfully" });
      form.reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: isEditing ? "Failed to update lesson" : "Failed to create lesson", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Lesson" : "Create New Lesson"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <ScrollArea className="h-[420px] pr-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lesson Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Getting Started" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Brief description" rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="estimated_duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Duration (minutes)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="15" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending
                      ? (isEditing ? "Updating..." : "Creating...")
                      : (isEditing ? "Update Lesson" : "Create Lesson")}
                  </Button>
                </div>
              </form>
            </Form>
          </ScrollArea>

          <CoachAIAside
            title="AI Lesson Assistant"
            description="Get AI suggestions to refine your lesson title and description based on the module context."
            actionKey="lesson_draft_suggest"
            context={{
              lessonId: editLesson?.id,
              moduleId,
              lessonTitle: form.watch("title"),
              lessonDescription: form.watch("description"),
              estimatedDuration: form.watch("estimated_duration"),
            }}
            customRenderer={(data) => {
              try {
                const suggestions = JSON.parse(data.output);
                return (
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="font-semibold text-foreground mb-1">Title:</p>
                      <p className="text-muted-foreground">{suggestions.title}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1">Description:</p>
                      <p className="text-muted-foreground whitespace-pre-wrap">{suggestions.description}</p>
                    </div>
                  </div>
                );
              } catch (e) {
                return <p className="text-sm text-muted-foreground">{data.output}</p>;
              }
            }}
            onInsert={(output) => {
              try {
                const suggestions = JSON.parse(output);
                form.setValue("title", suggestions.title, { shouldDirty: true });
                form.setValue("description", suggestions.description, { shouldDirty: true });
              } catch (e) {
                console.error("Failed to parse AI suggestions:", e);
              }
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
