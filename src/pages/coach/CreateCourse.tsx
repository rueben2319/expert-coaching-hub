import { useNavigate } from "react-router-dom";
import { coachSidebarSections } from "@/config/navigation";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CoachAIAside } from "@/components/ai/CoachAIAside";

const courseSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  description: z.string().trim().min(1, "Description is required").max(2000, "Description must be less than 2000 characters"),
  level: z.enum(["introduction", "intermediate", "advanced"]).optional(),
  tag: z.string().trim().max(100, "Tag must be less than 100 characters").optional(),
  category: z.string().trim().max(100, "Category must be less than 100 characters").optional(),
  is_free: z.boolean().default(true),
  price_credits: z.number().min(0, "Price must be 0 or greater").optional(),
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
      level: undefined,
      tag: "",
      category: "",
      is_free: true,
      price_credits: 0,
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
          level: data.level,
          tag: data.tag,
          category: data.category,
          is_free: data.is_free,
          price_credits: data.is_free ? 0 : (data.price_credits || 0),
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

  return (
    <DashboardLayout sidebarSections={coachSidebarSections}>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe your course content, objectives, and what students will learn..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Course Level</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select course level (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="introduction">Introduction</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Business, Technology, Health (optional)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tag"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tag</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Productivity, Leadership, Marketing (optional)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Pricing Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Pricing</h3>

                  <FormField
                    control={form.control}
                    name="is_free"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Free Course</FormLabel>
                          <FormDescription>
                            Toggle this on to make your course free, or off to set a credit price
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              if (checked) {
                                form.setValue("price_credits", 0);
                              }
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {!form.watch("is_free") && (
                    <FormField
                      control={form.control}
                      name="price_credits"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price (Credits)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Enter price in credits"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormDescription>
                            Set the price in credits that students need to pay to enroll in this course
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

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

        <CoachAIAside
          title="AI Course Assistant"
          description="Get AI suggestions to refine your course title, description, tag, and category."
          actionKey="course_outline_suggest"
          context={{
            courseTitle: form.watch("title"),
            courseDescription: form.watch("description"),
            courseLevel: form.watch("level"),
            courseTag: form.watch("tag"),
            courseCategory: form.watch("category"),
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
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-foreground mb-1">Tag:</p>
                      <p className="text-muted-foreground">{suggestions.tag}</p>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground mb-1">Category:</p>
                      <p className="text-muted-foreground">{suggestions.category}</p>
                    </div>
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
              form.setValue("tag", suggestions.tag, { shouldDirty: true });
              form.setValue("category", suggestions.category, { shouldDirty: true });
            } catch (e) {
              console.error("Failed to parse AI suggestions:", e);
            }
          }}
        />
      </div>
    </DashboardLayout>
  );
}
