import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const courseSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  description: z.string().trim().min(1, "Description is required").max(2000, "Description must be less than 2000 characters"),
});

type CourseFormData = z.infer<typeof courseSchema>;

export default function CreateCourse() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const form = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      title: "",
      description: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CourseFormData) => {
      const { data: course, error } = await supabase
        .from("courses")
        .insert({
          coach_id: user!.id,
          title: data.title,
          description: data.description,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;
      return course;
    },
    onSuccess: (course) => {
      toast({ title: "Course created successfully" });
      navigate(`/coach/courses/${course.id}/edit`);
    },
    onError: () => {
      toast({ title: "Failed to create course", variant: "destructive" });
    },
  });

  const onSubmit = (data: CourseFormData) => {
    createMutation.mutate(data);
  };

  const navItems = [
    { label: "Dashboard", href: "/coach" },
    { label: "Courses", href: "/coach/courses" },
    { label: "Create Course", href: "/coach/courses/create" },
  ];

  return (
    <DashboardLayout navItems={navItems}>
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Create New Course</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Course Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter course title" {...field} />
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
                      <FormLabel>Course Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe what students will learn"
                          rows={6}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/coach/courses")}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Course"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
