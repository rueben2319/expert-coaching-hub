import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import React, { useEffect } from "react";

const quizQuestionSchema = z.object({
  question: z.string().trim().min(1).max(500),
  options: z.array(z.string().trim().min(1)).min(2).max(6),
  correct_answer: z.number().min(0),
  explanation: z.string().trim().max(1000).optional(),
});

const contentSchema = z.object({
  content_type: z.enum(["text", "video", "quiz", "interactive", "file"]),
  is_required: z.boolean().default(true),
  text_content: z.string().trim().max(50000).optional(),
  video_url: z.string().optional().or(z.literal("")),
  quiz_questions: z.array(quizQuestionSchema).optional(),
  quiz_title: z.string().trim().max(200).optional(),
  quiz_description: z.string().trim().max(1000).optional(),
  passing_score: z.number().min(0).max(100).optional(),
}).refine((data) => {
  // Validate required fields based on content type
  switch (data.content_type) {
    case "text":
      return data.text_content && data.text_content.trim().length > 0;
    case "video":
    case "interactive":
    case "file":
      return data.video_url && data.video_url.trim().length > 0;
    case "quiz":
      return data.quiz_questions && Array.isArray(data.quiz_questions) && data.quiz_questions.length > 0 &&
             data.quiz_questions.every(q => q && q.question && q.question.trim().length > 0 && 
             q.options && Array.isArray(q.options) && q.options.length >= 2);
    default:
      return true;
  }
}, {
  message: "Please fill in all required fields for the selected content type",
  path: ["content_type"],
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

  const { data: nextOrderIndex } = useQuery({
    queryKey: ["next-order-index", lessonId],
    queryFn: async () => {
      console.log('🔍 Finding next order index for lesson:', lessonId);
      const { data, error } = await supabase
        .from("lesson_content")
        .select("order_index")
        .eq("lesson_id", lessonId)
        .order("order_index", { ascending: false })
        .limit(1);

      if (error) {
        console.error('❌ Error fetching order index:', error);
        return 0;
      }

      console.log('📊 Order index data:', data);
      const nextIndex = (data && data.length > 0) ? data[0].order_index + 1 : 0;
      console.log('🎯 Next order index:', nextIndex);
      return nextIndex;
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
      quiz_questions: editContent?.content_data?.questions || undefined, // Don't set default empty quiz
      quiz_title: editContent?.content_data?.title || "",
      quiz_description: editContent?.content_data?.description || "",
      passing_score: editContent?.content_data?.passingScore || 70,
    },
  });

  const contentType = form.watch("content_type");

  // Update form when dialog opens with edit data
  useEffect(() => {
    if (!open) return;
    
    if (editContent && editContent.id && editContent.content_type) {
      // Extract content based on type
      let textContent = "";
      let videoUrl = "";
      let quizQuestions = [{
        question: "",
        options: ["", ""],
        correct_answer: 0,
        explanation: "",
      }];
      let quizTitle = "";
      let quizDescription = "";
      let passingScore = 70;
      
      if (editContent.content_type === "text") {
        textContent = editContent.content_data?.text || editContent.content_data?.html || "";
      } else if (editContent.content_type === "video" || editContent.content_type === "interactive" || editContent.content_type === "file") {
        videoUrl = editContent.content_data?.url || "";
      } else if (editContent.content_type === "quiz") {
        // Handle both old and new quiz formats
        if (editContent.content_data?.questions) {
          // New format with multiple questions
          quizQuestions = editContent.content_data.questions;
          quizTitle = editContent.content_data?.title || "";
          quizDescription = editContent.content_data?.description || "";
          passingScore = editContent.content_data?.passingScore || 70;
        } else {
          // Legacy format with single question
          quizQuestions = [{
            question: editContent.content_data?.question || "",
            options: editContent.content_data?.options || ["", ""],
            correct_answer: editContent.content_data?.correct || 0,
            explanation: editContent.content_data?.explanation || "",
          }];
        }
      }
      
      // Use setTimeout to ensure the form is ready
      setTimeout(() => {
        form.reset({
          content_type: editContent.content_type,
          is_required: editContent.is_required ?? true,
          text_content: textContent,
          video_url: videoUrl,
          quiz_questions: quizQuestions,
          quiz_title: quizTitle,
          quiz_description: quizDescription,
          passing_score: passingScore,
        });
      }, 100);
    } else {
      // Reset to defaults when creating new content
      form.reset({
        content_type: "text",
        is_required: true,
        text_content: "",
        video_url: "",
        quiz_questions: undefined, // Don't set empty quiz questions
        quiz_title: "",
        quiz_description: "",
        passing_score: 70,
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
        contentData = {
          title: data.quiz_title || "",
          description: data.quiz_description || "",
          questions: data.quiz_questions?.map(q => ({
            id: `question-${Date.now()}-${Math.random()}`,
            question: q.question,
            type: "single",
            options: q.options,
            correctAnswers: [q.correct_answer],
            explanation: q.explanation
          })) || [],
          passingScore: data.passing_score || 70
        };
      } else if (data.content_type === "interactive") {
        contentData = { url: data.video_url || "" };
      } else if (data.content_type === "file") {
        contentData = { url: data.video_url || "", filename: "File" };
      }

      const insertData = {
        lesson_id: lessonId,
        content_type: data.content_type,
        content_data: contentData,
        is_required: data.is_required,
        order_index: nextOrderIndex || 0,
      };

      console.log('💾 Final insert data:', insertData);
      console.log('🎯 Using order_index:', nextOrderIndex);

      if (isEditing) {
        console.log('✏️ Updating existing content:', editContent.id);
        const { error } = await supabase
          .from("lesson_content")
          .update({
            content_type: data.content_type,
            content_data: contentData,
            is_required: data.is_required,
          })
          .eq("id", editContent.id);
        if (error) {
          console.error('❌ Update error:', error);
          throw error;
        }
        console.log('✅ Content updated successfully');
      } else {
        console.log('➕ Inserting new content');
        const { error, data: insertedData } = await supabase.from("lesson_content").insert(insertData).select();
        if (error) {
          console.error('❌ Insert error:', error);
          console.error('❌ Insert error details:', {
            code: error.code,
            details: error.details,
            hint: error.hint,
            message: error.message
          });
          throw error;
        }
        console.log('✅ Content inserted successfully:', insertedData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-modules"] });
      toast({ title: isEditing ? "Content updated successfully" : "Content added successfully" });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ 
        title: isEditing ? "Failed to update content" : "Failed to add content", 
        variant: "destructive",
        description: error?.message || "Please check your form and try again."
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">
            {isEditing ? `Edit Content (${editContent?.content_type})` : "Add Content to Lesson"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => {
            createMutation.mutate(data);
          }, (errors) => {
            console.error('Form validation errors:', errors);
          })} className="space-y-4 px-1">
            <FormField
              control={form.control}
              name="content_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content Type</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
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
              <div className="space-y-4">
                <h3 className="font-semibold text-base sm:text-lg">Quiz Builder</h3>
                
                <FormField
                  control={form.control}
                  name="quiz_title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quiz Title (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter quiz title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quiz_description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quiz Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter quiz description" rows={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="passing_score"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Passing Score (%)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          max="100" 
                          placeholder="70" 
                          value={field.value || 70}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 70)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quiz_questions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Questions</FormLabel>
                      <div className="space-y-4">
                        {field.value?.map((question, questionIndex) => (
                          <div key={questionIndex} className="space-y-3 p-4 bg-muted/30 rounded-lg">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">Question {questionIndex + 1}</h4>
                              {field.value && field.value.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const newQuestions = field.value?.filter((_, i) => i !== questionIndex);
                                    field.onChange(newQuestions);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            
                            <div>
                              <Label>Question Text</Label>
                              <Textarea
                                placeholder="Enter your question"
                                rows={2}
                                value={question.question}
                                onChange={(e) => {
                                  const newQuestions = [...(field.value || [])];
                                  newQuestions[questionIndex] = {
                                    ...newQuestions[questionIndex],
                                    question: e.target.value
                                  };
                                  field.onChange(newQuestions);
                                }}
                              />
                            </div>

                            <div>
                              <Label>Answer Options</Label>
                              <div className="space-y-2 mt-2">
                                {question.options?.map((option, optionIndex) => (
                                  <div key={optionIndex} className="flex items-center gap-2">
                                    <div className="flex-1">
                                      <Input
                                        placeholder={`Option ${optionIndex + 1}`}
                                        value={option}
                                        onChange={(e) => {
                                          const newQuestions = [...(field.value || [])];
                                          const newOptions = [...(newQuestions[questionIndex].options || [])];
                                          newOptions[optionIndex] = e.target.value;
                                          newQuestions[questionIndex] = {
                                            ...newQuestions[questionIndex],
                                            options: newOptions
                                          };
                                          field.onChange(newQuestions);
                                        }}
                                      />
                                    </div>
                                    {question.options && question.options.length > 2 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="shrink-0 h-8 w-8 p-0"
                                        onClick={() => {
                                          const newQuestions = [...(field.value || [])];
                                          const newOptions = newQuestions[questionIndex].options?.filter((_, i) => i !== optionIndex);
                                          newQuestions[questionIndex] = {
                                            ...newQuestions[questionIndex],
                                            options: newOptions,
                                            correct_answer: newQuestions[questionIndex].correct_answer >= optionIndex 
                                              ? Math.max(0, newQuestions[questionIndex].correct_answer - 1)
                                              : newQuestions[questionIndex].correct_answer
                                          };
                                          field.onChange(newQuestions);
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                ))}
                                {question.options && question.options.length < 6 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="w-full sm:w-auto"
                                    onClick={() => {
                                      const newQuestions = [...(field.value || [])];
                                      const newOptions = [...(newQuestions[questionIndex].options || []), ""];
                                      newQuestions[questionIndex] = {
                                        ...newQuestions[questionIndex],
                                        options: newOptions
                                      };
                                      field.onChange(newQuestions);
                                    }}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Option
                                  </Button>
                                )}
                              </div>
                            </div>

                            <div>
                              <Label>Correct Answer</Label>
                              <RadioGroup
                                value={question.correct_answer?.toString()}
                                onValueChange={(value) => {
                                  const newQuestions = [...(field.value || [])];
                                  newQuestions[questionIndex] = {
                                    ...newQuestions[questionIndex],
                                    correct_answer: parseInt(value)
                                  };
                                  field.onChange(newQuestions);
                                }}
                                className="space-y-2 mt-2"
                              >
                                {question.options?.map((option, optionIndex) => (
                                  <div key={optionIndex} className="flex items-start space-x-2 p-2 rounded border">
                                    <RadioGroupItem 
                                      value={optionIndex.toString()} 
                                      id={`q${questionIndex}-option-${optionIndex}`} 
                                      className="mt-0.5 shrink-0"
                                    />
                                    <Label 
                                      htmlFor={`q${questionIndex}-option-${optionIndex}`} 
                                      className="flex-1 text-sm leading-relaxed cursor-pointer"
                                    >
                                      {option || `Option ${optionIndex + 1}`}
                                    </Label>
                                  </div>
                                ))}
                              </RadioGroup>
                            </div>

                            <div>
                              <Label>Explanation (Optional)</Label>
                              <Textarea
                                placeholder="Explain why this is the correct answer"
                                rows={2}
                                value={question.explanation || ""}
                                onChange={(e) => {
                                  const newQuestions = [...(field.value || [])];
                                  newQuestions[questionIndex] = {
                                    ...newQuestions[questionIndex],
                                    explanation: e.target.value
                                  };
                                  field.onChange(newQuestions);
                                }}
                              />
                            </div>
                          </div>
                        ))}
                        
                        {field.value && field.value.length < 10 && (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              const newQuestions = [...(field.value || []), {
                                question: "",
                                options: ["", ""],
                                correct_answer: 0,
                                explanation: "",
                              }];
                              field.onChange(newQuestions);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Question
                          </Button>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              </div>
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
                <FormItem className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 sm:p-4 space-y-2 sm:space-y-0">
                  <div className="flex-1">
                    <FormLabel className="text-sm sm:text-base">Required Content</FormLabel>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Students must complete this to progress
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                {createMutation.isPending 
                  ? (isEditing ? "Updating..." : "Creating...") 
                  : (isEditing ? "Update Content" : "Create Content")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
