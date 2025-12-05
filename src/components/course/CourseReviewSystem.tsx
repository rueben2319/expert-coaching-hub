import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Star, ThumbsUp } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { CourseReview } from "@/types/course";
import { DatabaseStatus } from "./DatabaseStatus";

const reviewSchema = z.object({
  rating: z.number().min(1, "Please select a rating").max(5),
  review_text: z.string().trim().max(1000).optional(),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

interface CourseReviewSystemProps {
  courseId: string;
  isEnrolled: boolean;
  averageRating?: number | null;
  reviewCount?: number | null;
}

export function CourseReviewSystem({ 
  courseId, 
  isEnrolled, 
  averageRating = 0, 
  reviewCount = 0 
}: CourseReviewSystemProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["course-reviews", courseId],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("course_reviews")
          .select("*")
          .eq("course_id", courseId)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching reviews:", error);
          return [];
        }
        
        if (!data?.length) return [];
        
        // Fetch profiles for all reviewers
        const userIds = [...new Set(data.map(r => r.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        
        return data.map(review => ({
          ...review,
          profiles: profileMap.get(review.user_id) || { full_name: "Anonymous", avatar_url: null }
        })) as unknown as CourseReview[];
      } catch (err) {
        console.error("Database error:", err);
        return [];
      }
    },
    enabled: !!courseId,
  });

  const { data: userReview } = useQuery<{
    id: string;
    rating: number;
    review_text: string | null;
    course_id: string;
    user_id: string;
  } | null>({
    queryKey: ["user-review", courseId],
    queryFn: async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return null;

        const { data, error } = await supabase
          .from("course_reviews")
          .select("id, rating, review_text, course_id, user_id")
          .eq("course_id", courseId)
          .eq("user_id", userData.user.id)
          .single();

        if (error && error.code !== "PGRST116") {
          console.error("Error fetching user review:", error);
          return null;
        }
        return data;
      } catch (err) {
        console.error("Database error:", err);
        return null;
      }
    },
    enabled: !!courseId,
  });

  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: userReview?.rating || 0,
      review_text: userReview?.review_text || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ReviewFormData) => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("User not authenticated");

        if (userReview) {
          // Update existing review
          const { error } = await supabase
            .from("course_reviews")
            .update({
              rating: data.rating,
              review_text: data.review_text || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", userReview.id);

          if (error) throw error;
        } else {
          // Create new review
          const { error } = await supabase
            .from("course_reviews")
            .insert({
              course_id: courseId,
              user_id: userData.user.id,
              rating: data.rating,
              review_text: data.review_text || null,
            });

          if (error) throw error;
        }
      } catch (err) {
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-reviews", courseId] });
      queryClient.invalidateQueries({ queryKey: ["user-review", courseId] });
      toast({ 
        title: userReview ? "Review updated" : "Review submitted",
        description: "Thank you for your feedback!"
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Failed to submit review",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const renderStars = (rating: number, interactive = false, onChange?: (value: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-5 h-5 ${
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            } ${interactive ? "cursor-pointer hover:text-yellow-400" : ""}`}
            onClick={() => interactive && onChange && onChange(star)}
          />
        ))}
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <DatabaseStatus 
      tableName="course_reviews"
      isLoading={isLoading}
      hasError={reviews === undefined}
    >
      <div className="space-y-6">
        {/* Rating Summary */}
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Course Reviews</span>
            {isEnrolled && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    {userReview ? "Edit Review" : "Write Review"}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {userReview ? "Edit Your Review" : "Write a Review"}
                    </DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
                      className="space-y-4"
                    >
                      <FormField
                        control={form.control}
                        name="rating"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rating</FormLabel>
                            <FormControl>
                              <div className="flex items-center gap-2">
                                {renderStars(field.value, true, field.onChange)}
                                <span className="text-sm text-muted-foreground">
                                  {field.value > 0 ? `${field.value} out of 5` : "Select rating"}
                                </span>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="review_text"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Review (Optional)</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Share your experience with this course..."
                                rows={4}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={createMutation.isPending}
                        >
                          {createMutation.isPending
                            ? "Submitting..."
                            : userReview
                            ? "Update Review"
                            : "Submit Review"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold">
                {averageRating ? averageRating.toFixed(1) : "0.0"}
              </span>
              {renderStars(Math.round(averageRating || 0))}
            </div>
            <div>
              <div className="font-medium">{reviewCount} review{reviewCount !== 1 ? "s" : ""}</div>
              {reviewCount > 0 && (
                <div className="text-sm text-muted-foreground">
                  Based on student experiences
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">Loading reviews...</div>
        ) : reviews && reviews.length > 0 ? (
          reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      {review.profiles.avatar_url ? (
                        <img
                          src={review.profiles.avatar_url}
                          alt={review.profiles.full_name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-medium">
                          {review.profiles.full_name?.[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="font-medium">{review.profiles.full_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(review.created_at)}
                      </div>
                    </div>
                  </div>
                  {renderStars(review.rating)}
                </div>
                {review.review_text && (
                  <div className="mt-4 text-sm leading-relaxed">
                    {review.review_text}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="text-center py-8">
              <div className="text-muted-foreground">
                No reviews yet. Be the first to share your experience!
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      </div>
    </DatabaseStatus>
  );
}
