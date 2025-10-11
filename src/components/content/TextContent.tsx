import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TextContentProps {
  content: {
    text: string;
    format?: "html" | "markdown" | "plain";
  };
  contentId: string;
  onComplete?: () => void;
}

export function TextContent({ content, contentId, onComplete }: TextContentProps) {
  const { user } = useAuth();
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Check if content is already completed
  useEffect(() => {
    const checkCompletionStatus = async () => {
      if (!user || !contentId) return;

      const { data } = await supabase
        .from("content_interactions")
        .select("is_completed")
        .eq("user_id", user.id)
        .eq("content_id", contentId)
        .single();

      if (data?.is_completed) {
        setIsCompleted(true);
        setHasScrolledToBottom(true);
      }
    };

    checkCompletionStatus();
  }, [user, contentId]);

  // Handle scroll events
  const handleScroll = () => {
    if (!contentRef.current || isCompleted) return;

    const element = contentRef.current;
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;

    // Consider scrolled to bottom if within 50px of the bottom
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50;

    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  // Mark content as completed
  const handleMarkComplete = async () => {
    if (!user || !contentId || isCompleted) return;

    try {
      await supabase
        .from("content_interactions")
        .upsert({
          user_id: user.id,
          content_id: contentId,
          is_completed: true,
          interaction_data: {
            scrolled_to_bottom: true,
            completed_at: new Date().toISOString(),
          },
        });

      setIsCompleted(true);
      if (onComplete) onComplete();
    } catch (error) {
      console.error("Error marking text content as complete:", error);
    }
  };

  return (
    <div className="space-y-4">
      <div
        ref={contentRef}
        onScroll={handleScroll}
        className="prose prose-sm max-w-none dark:prose-invert max-h-96 overflow-y-auto border rounded-lg p-4"
        dangerouslySetInnerHTML={{ __html: content.text }}
      />

      {hasScrolledToBottom && !isCompleted && (
        <div className="flex justify-center">
          <Button onClick={handleMarkComplete} className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Mark Complete
          </Button>
        </div>
      )}

      {isCompleted && (
        <div className="flex justify-center">
          <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950 px-4 py-2 rounded-lg">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Completed</span>
          </div>
        </div>
      )}

      {!hasScrolledToBottom && !isCompleted && (
        <p className="text-xs text-muted-foreground text-center">
          💡 Scroll to the bottom to mark this content as complete
        </p>
      )}
    </div>
  );
}
