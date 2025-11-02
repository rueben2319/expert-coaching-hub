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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";

const moduleSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(1000).optional(),
});

type ModuleFormData = z.infer<typeof moduleSchema>;

interface CreateModuleDialogProps {
  courseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editModule?: any;
}

type ModuleTabKey = "form" | "ai";

export function CreateModuleDialog({ courseId, open, onOpenChange, editModule }: CreateModuleDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!editModule;

  const { data: moduleCount } = useQuery({
    queryKey: ["module-count", courseId],
    queryFn: async () => {
      const { count } = await supabase
        .from("course_modules")
        .select("*", { count: "exact", head: true })
        .eq("course_id", courseId);
      return count || 0;
    },
    enabled: !isEditing,
  });

  const form = useForm<ModuleFormData>({
    resolver: zodResolver(moduleSchema),
    defaultValues: {
      title: editModule?.title || "",
      description: editModule?.description || "",
    },
  });

  const [activeTab, setActiveTab] = useState<ModuleTabKey>("form");

  useEffect(() => {
    if (!open) {
      setActiveTab("form");
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: async (data: ModuleFormData) => {
      if (isEditing) {
        const { error } = await supabase
          .from("course_modules")
          .update({
            title: data.title,
            description: data.description || null,
          })
          .eq("id", editModule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("course_modules").insert({
          course_id: courseId,
          title: data.title,
          description: data.description || null,
          order_index: moduleCount || 0,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-modules", courseId] });
      toast({ title: isEditing ? "Module updated successfully" : "Module created successfully" });
      form.reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: isEditing ? "Failed to update module" : "Failed to create module", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Module" : "Create New Module"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as ModuleTabKey)}
              className="space-y-4"
            >
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="form">Form</TabsTrigger>
                <TabsTrigger value="ai">AI Assistant</TabsTrigger>
              </TabsList>

              <TabsContent value="form" className="h-[48vh]">
                <ScrollArea className="h-full pr-1 lg:pr-4">
                  <div className="space-y-4 pb-6">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Module Title</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Introduction to..." {...field} />
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
                            <Textarea placeholder="What will students learn?" rows={6} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="ai" className="h-[48vh]">
                <ScrollArea className="h-full pr-1">
                  <div className="space-y-4 pb-6">
                    <CoachAIAside
                      title="AI Module Assistant"
                      description="Get AI suggestions to refine your module title and description based on the course context."
                      actionKey="module_outline_suggest"
                      context={{
                        courseId,
                        moduleId: editModule?.id,
                        moduleTitle: form.watch("title"),
                        moduleDescription: form.watch("description"),
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
                          setActiveTab("form");
                        } catch (e) {
                          console.error("Failed to parse AI suggestions:", e);
                        }
                      }}
                    />
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="w-full sm:w-auto">
                {createMutation.isPending
                  ? isEditing
                    ? "Updating..."
                    : "Creating..."
                  : isEditing
                    ? "Update Module"
                    : "Create Module"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
