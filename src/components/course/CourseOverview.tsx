import { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const courseSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().min(1, "Description is required").max(2000),
  level: z.enum(["introduction", "intermediate", "advanced"]).optional(),
  tag: z.string().trim().max(100, "Tag must be less than 100 characters").optional(),
  category: z.string().trim().max(100, "Category must be less than 100 characters").optional(),
  is_free: z.boolean().default(true),
  price_credits: z.number().min(0, "Price must be 0 or greater").optional(),
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
      level: course.level || undefined,
      tag: course.tag || "",
      category: course.category || "",
      is_free: course.is_free ?? true,
      price_credits: course.price_credits || 0,
    },
  });

  // Format duration helper
  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Course Information</h2>
      </div>

      {/* Course Duration Display */}
      {course.total_duration > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Total Course Duration</p>
                <p className="text-2xl font-bold text-primary">{formatDuration(course.total_duration)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-6">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Course Title</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={200} />
                </FormControl>
                <FormDescription>
                  {field.value?.length || 0}/200 characters
                </FormDescription>
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
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select course level" />
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
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea 
                    {...field} 
                    rows={4}
                    maxLength={2000}
                    placeholder="Describe what students will learn in this course..."
                  />
                </FormControl>
                <FormDescription>
                  {field.value?.length || 0}/2000 characters
                </FormDescription>
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
                  <Input placeholder="e.g., Business, Technology, Health" {...field} maxLength={100} />
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
                  <Input placeholder="e.g., Productivity, Leadership, Marketing" {...field} maxLength={100} />
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

          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
