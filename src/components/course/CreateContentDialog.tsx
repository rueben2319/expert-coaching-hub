import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useState } from "react";

const contentSchema = z.object({
  content_type: z.enum(["text", "video", "quiz", "interactive", "file"]),
  is_required: z.boolean().default(true),
  text_content: z.string().trim().max(50000).optional(),
  video_url: z.string().url().optional().or(z.literal("")),
  quiz_question: z.string().trim().max(500).optional(),
});

type ContentFormData = z.infer<typeof contentSchema>;

interface CreateContentDialogProps {
  lessonId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateContentDialog({ lessonId, open, onOpenChange }: CreateContentDialogProps) {
  const queryClient = useQueryClient();
  const [contentType, setContentType] = useState<"text" | "video" | "quiz" | "interactive" | "file">("text");

  const { data: contentCount } = useQuery({
    queryKey: ["content-count", lessonId],
    queryFn: async () => {
      const { count } = await supabase
        .from("lesson_content")
        .select("*", { count: "exact", head: true })
        .eq("lesson_id", lessonId);
      return count || 0;
    },
  });

  const form = useForm<ContentFormData>({
    resolver: zodResolver(contentSchema),
    defaultValues: {
      content_type: "text",
      is_required: true,
      text_content: "",
      video_url: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ContentFormData) => {
      let contentData = {};

      if (data.content_type === "text") {
        contentData = { html: data.text_content || "" };
      } else if (data.content_type === "video") {
        contentData = { url: data.video_url || "" };
      } else if (data.content_type === "quiz") {
        contentData = { question: data.quiz_question || "", options: [], correct: 0 };
      }

      const { error } = await supabase.from("lesson_content").insert({
        lesson_id: lessonId,
        content_type: data.content_type,
        content_data: contentData,
        is_required: data.is_required,
        order_index: contentCount || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-modules"] });
      toast({ title: "Content added successfully" });
      form.reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to add content", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Content to Lesson</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="content_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content Type</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      setContentType(value as any);
                    }}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select content type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="quiz">Quiz</SelectItem>
                      <SelectItem value="interactive">Interactive</SelectItem>
                      <SelectItem value="file">File</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {contentType === "text" && (
              <FormField
                control={form.control}
                name="text_content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Text Content</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter your lesson content" rows={8} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {contentType === "video" && (
              <FormField
                control={form.control}
                name="video_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Video URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://youtube.com/watch?v=..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {contentType === "quiz" && (
              <FormField
                control={form.control}
                name="quiz_question"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quiz Question</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter your question" rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="is_required"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <FormLabel>Required Content</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Students must complete this to progress
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Adding..." : "Add Content"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
