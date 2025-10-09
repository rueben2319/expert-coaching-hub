import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const courseSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().min(1, "Description is required").max(2000),
});

type CourseFormData = z.infer<typeof courseSchema>;

interface CourseOverviewProps {
  course: any;
}

export function CourseOverview({ course }: CourseOverviewProps) {
  const queryClient = useQueryClient();

  const form = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      title: course.title,
      description: course.description || "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CourseFormData) => {
      const { error } = await supabase
        .from("courses")
        .update(data)
        .eq("id", course.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course", course.id] });
      toast({ title: "Course updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update course", variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Course Information</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Course Title</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={6} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
