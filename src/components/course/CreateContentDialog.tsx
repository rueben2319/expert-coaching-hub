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
import React, { useState, useEffect } from "react";

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
  editContent?: any;
}

export function CreateContentDialog({ lessonId, open, onOpenChange, editContent }: CreateContentDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!editContent;
  const [contentType, setContentType] = useState<"text" | "video" | "quiz" | "interactive" | "file">(
    editContent?.content_type || "text"
  );

  const { data: contentCount } = useQuery({
    queryKey: ["content-count", lessonId],
    queryFn: async () => {
      const { count } = await supabase
        .from("lesson_content")
        .select("*", { count: "exact", head: true })
        .eq("lesson_id", lessonId);
      return count || 0;
    },
    enabled: !isEditing,
  });

  const form = useForm<ContentFormData>({
    resolver: zodResolver(contentSchema),
    defaultValues: {
      content_type: editContent?.content_type || "text",
      is_required: editContent?.is_required ?? true,
      text_content: editContent?.content_data?.text || editContent?.content_data?.html || "",
      video_url: editContent?.content_data?.url || "",
      quiz_question: editContent?.content_data?.question || "",
    },
  });

  // Update contentType state and form when dialog opens with edit data
  useEffect(() => {
    if (!open) return;
    
    if (editContent && editContent.id && editContent.content_type) {
      const contentType = editContent.content_type;
      setContentType(contentType);
      
      // Extract content based on type
      let textContent = "";
      let videoUrl = "";
      let quizQuestion = "";
      
      if (contentType === "text") {
        textContent = editContent.content_data?.text || editContent.content_data?.html || "";
      } else if (contentType === "video" || contentType === "interactive" || contentType === "file") {
        videoUrl = editContent.content_data?.url || "";
      } else if (contentType === "quiz") {
        quizQuestion = editContent.content_data?.question || "";
      }
      
      // Use setTimeout to ensure the form is ready
      setTimeout(() => {
        form.reset({
          content_type: contentType,
          is_required: editContent.is_required ?? true,
          text_content: textContent,
          video_url: videoUrl,
          quiz_question: quizQuestion,
        });
      }, 100);
    } else {
      // Reset to defaults when creating new content
      setContentType("text");
      form.reset({
        content_type: "text",
        is_required: true,
        text_content: "",
        video_url: "",
        quiz_question: "",
      });
    }
  }, [open, editContent, isEditing, form]);

  const createMutation = useMutation({
    mutationFn: async (data: ContentFormData) => {
      let contentData = {};

      if (data.content_type === "text") {
        contentData = { text: data.text_content || "", html: data.text_content || "" };
      } else if (data.content_type === "video") {
        contentData = { url: data.video_url || "" };
      } else if (data.content_type === "quiz") {
        contentData = { question: data.quiz_question || "", options: [], correct: 0 };
      } else if (data.content_type === "interactive") {
        contentData = { url: data.video_url || "" };
      } else if (data.content_type === "file") {
        contentData = { url: data.video_url || "", filename: "File" };
      }

      if (isEditing) {
        const { error } = await supabase
          .from("lesson_content")
          .update({
            content_type: data.content_type,
            content_data: contentData,
            is_required: data.is_required,
          })
          .eq("id", editContent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lesson_content").insert({
          lesson_id: lessonId,
          content_type: data.content_type,
          content_data: contentData,
          is_required: data.is_required,
          order_index: contentCount || 0,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-modules"] });
      toast({ title: isEditing ? "Content updated successfully" : "Content added successfully" });
      form.reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: isEditing ? "Failed to update content" : "Failed to add content", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit Content (${editContent?.content_type})` : "Add Content to Lesson"}
          </DialogTitle>
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
                    value={field.value}
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

            {contentType === "interactive" && (
              <FormField
                control={form.control}
                name="video_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interactive Content URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/interactive-content" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {contentType === "file" && (
              <FormField
                control={form.control}
                name="video_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>File URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/file.pdf" {...field} />
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
