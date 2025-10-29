import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DOMPurify from "dompurify";
import { logger } from "@/lib/logger";

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
  const [timeSpent, setTimeSpent] = useState(0);
  const [requiredTime, setRequiredTime] = useState(0);
  const [isShortContent, setIsShortContent] = useState(false);
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

  // Calculate required reading time based on word count
  useEffect(() => {
    const text = content?.text ?? "";
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    // Average reading speed: 200 words per minute
    // Minimum 10 seconds even for short content
    const readingTimeSeconds = Math.max((wordCount / 200) * 60, 10);
    setRequiredTime(readingTimeSeconds);
  }, [content]);

  // Check if content is short enough to not require scrolling
  useEffect(() => {
    const checkContentHeight = () => {
      if (contentRef.current) {
        const element = contentRef.current;
        const isShort = element.scrollHeight <= element.clientHeight + 10;
        setIsShortContent(isShort);
        if (isShort) {
          // Auto-enable scroll completion for short content
          setHasScrolledToBottom(true);
        }
      }
    };

    // Check after content is rendered
    const timeoutId = setTimeout(checkContentHeight, 100);
    return () => clearTimeout(timeoutId);
  }, [content]);

  // Track time spent on content with proper visibility handling
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    const startTimer = () => {
      if (interval) return; // Already running
      interval = setInterval(() => {
        setTimeSpent(prev => prev + 1);
      }, 1000);
    };

    const stopTimer = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopTimer();
      } else if (!isCompleted) {
        startTimer();
      }
    };

    // Start timer if conditions are met
    if (!isCompleted && !document.hidden) {
      startTimer();
    }

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isCompleted]);

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
            scrolled_to_bottom: hasScrolledToBottom,
            time_spent: timeSpent,
            required_time: requiredTime,
            is_short_content: isShortContent,
            completed_at: new Date().toISOString(),
          },
        });

      setIsCompleted(true);
      if (onComplete) onComplete();
    } catch (error) {
      logger.error("Error marking text content as complete:", error);
    }
  };

  // Check if user can mark content as complete
  const canMarkComplete = hasScrolledToBottom && timeSpent >= requiredTime;

  // Basic HTML escaping for non-HTML formats
  const escapeHtml = (input: string) =>
    input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  // Lightweight markdown to HTML (very conservative)
  const markdownToHtml = (md: string) => {
    const escaped = escapeHtml(md);
    // Bold **text** and italic *text*
    const formatted = escaped
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+?)`/g, "<code>$1</code>");

    // Paragraphs: split on blank lines, join with <p>
    const paragraphs = formatted
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`) // single newlines -> <br/>
      .join("");

    return paragraphs;
  };

  const getRenderedHtml = () => {
    const text = content?.text ?? "";
    const format = content?.format ?? "plain";
    
    let html = "";
    if (format === "html") {
      html = text;
    } else if (format === "markdown") {
      html = markdownToHtml(text);
    } else {
      // plain text
      html = `<p>${escapeHtml(text).replace(/\n/g, "<br/>")}</p>`;
    }
    
    // Use DOMPurify for robust XSS protection
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre'],
      ALLOWED_ATTR: ['href', 'rel', 'target', 'class'],
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['target'],
      ADD_TAGS: [],
    });
  };

  return (
    <div className="space-y-4">
      <div
        ref={contentRef}
        onScroll={handleScroll}
        className="prose prose-sm max-w-none dark:prose-invert max-h-96 overflow-y-auto border rounded-lg p-4"
        dangerouslySetInnerHTML={{ __html: getRenderedHtml() }}
      />

      {hasScrolledToBottom && !isCompleted && (
        <div className="flex flex-col items-center gap-2">
          {timeSpent < requiredTime ? (
            <div className="text-sm text-muted-foreground">
              ⏱️ Keep reading... {Math.ceil(requiredTime - timeSpent)}s remaining
            </div>
          ) : (
            <Button onClick={handleMarkComplete} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Mark Complete
            </Button>
          )}
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

      {!hasScrolledToBottom && !isCompleted && !isShortContent && (
        <p className="text-xs text-muted-foreground text-center">
          💡 Scroll to the bottom and spend at least {Math.ceil(requiredTime)}s reading to mark this content as complete
        </p>
      )}
      {isShortContent && !isCompleted && timeSpent < requiredTime && (
        <p className="text-xs text-muted-foreground text-center">
          💡 Spend at least {Math.ceil(requiredTime)}s reading to mark this content as complete ({Math.ceil(requiredTime - timeSpent)}s remaining)
        </p>
      )}
    </div>
  );
}
