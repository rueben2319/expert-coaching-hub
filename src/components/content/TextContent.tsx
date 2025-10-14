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

  // Basic HTML escaping for non-HTML formats
  const escapeHtml = (input: string) =>
    input
      .replaceAll(/&/g, "&amp;")
      .replaceAll(/</g, "&lt;")
      .replaceAll(/>/g, "&gt;")
      .replaceAll(/"/g, "&quot;")
      .replaceAll(/'/g, "&#39;");

  // Very small, conservative sanitizer for HTML content
  const sanitizeHtml = (unsafeHtml: string) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(unsafeHtml, "text/html");
      const disallowedTags = new Set([
        "script",
        "style",
        "iframe",
        "object",
        "embed",
        "link",
        "meta",
        "form",
      ]);

      const walk = (node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;

          // Drop disallowed elements entirely
          if (disallowedTags.has(el.tagName.toLowerCase())) {
            el.remove();
            return;
          }

          // Remove event handlers and javascript/data URLs
          // Clone array because attributes is live
          Array.from(el.attributes).forEach((attr) => {
            const name = attr.name.toLowerCase();
            const value = attr.value.trim();
            const isEventHandler = name.startsWith("on");
            const isUriAttr = name === "src" || name === "href" || name === "xlink:href";
            const lowerValue = value.toLowerCase();
            const hasJsProtocol = lowerValue.startsWith("javascript:");
            const hasDataProtocol = lowerValue.startsWith("data:");
            if (isEventHandler || (isUriAttr && (hasJsProtocol || hasDataProtocol))) {
              el.removeAttribute(attr.name);
            }
          });

          // Safe defaults for links
          if (el.tagName.toLowerCase() === "a") {
            if (!el.getAttribute("rel")) el.setAttribute("rel", "noopener noreferrer");
            // Do not force target; allow default behavior
          }

          // Recurse
          Array.from(el.childNodes).forEach(walk);
        }
      };

      Array.from(doc.body.childNodes).forEach(walk);
      return doc.body.innerHTML;
    } catch {
      // Fallback to escaped text if DOMParser fails
      return escapeHtml(unsafeHtml);
    }
  };

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
      .map((p) => `<p>${p.replaceAll("\n", "<br/>")}</p>`) // single newlines -> <br/>
      .join("");

    return paragraphs;
  };

  const getRenderedHtml = () => {
    const text = content?.text ?? "";
    const format = content?.format ?? "plain";
    if (format === "html") return sanitizeHtml(text);
    if (format === "markdown") return sanitizeHtml(markdownToHtml(text));
    // plain
    return sanitizeHtml(`<p>${escapeHtml(text).replaceAll("\n", "<br/>")}</p>`);
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
