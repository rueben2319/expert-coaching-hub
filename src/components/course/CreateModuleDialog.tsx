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

const moduleSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(1000).optional(),
});

type ModuleFormData = z.infer<typeof moduleSchema>;

interface CreateModuleDialogProps {
  courseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateModuleDialog({ courseId, open, onOpenChange }: CreateModuleDialogProps) {
  const queryClient = useQueryClient();

  const { data: moduleCount } = useQuery({
    queryKey: ["module-count", courseId],
    queryFn: async () => {
      const { count } = await supabase
        .from("course_modules")
        .select("*", { count: "exact", head: true })
        .eq("course_id", courseId);
      return count || 0;
    },
  });

  const form = useForm<ModuleFormData>({
    resolver: zodResolver(moduleSchema),
    defaultValues: {
      title: "",
      description: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ModuleFormData) => {
      const { error } = await supabase.from("course_modules").insert({
        course_id: courseId,
        title: data.title,
        description: data.description || null,
        order_index: moduleCount || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-modules", courseId] });
      toast({ title: "Module created successfully" });
      form.reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to create module", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Module</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
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
                    <Textarea placeholder="What will students learn?" rows={3} {...field} />
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
                {createMutation.isPending ? "Creating..." : "Create Module"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
