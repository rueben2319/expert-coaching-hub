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
}

export function CreateLessonDialog({ moduleId, open, onOpenChange }: CreateLessonDialogProps) {
  const queryClient = useQueryClient();

  const { data: lessonCount } = useQuery({
    queryKey: ["lesson-count", moduleId],
    queryFn: async () => {
      const { count } = await supabase
        .from("lessons")
        .select("*", { count: "exact", head: true })
        .eq("module_id", moduleId);
      return count || 0;
    },
  });

  const form = useForm<LessonFormData>({
    resolver: zodResolver(lessonSchema),
    defaultValues: {
      title: "",
      description: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: LessonFormData) => {
      const { error } = await supabase.from("lessons").insert({
        module_id: moduleId,
        title: data.title,
        description: data.description || null,
        estimated_duration: data.estimated_duration || null,
        order_index: lessonCount || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-modules"] });
      toast({ title: "Lesson created successfully" });
      form.reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to create lesson", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Lesson</DialogTitle>
        </DialogHeader>
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
                    <Textarea placeholder="Brief description" rows={2} {...field} />
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
                {createMutation.isPending ? "Creating..." : "Create Lesson"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
