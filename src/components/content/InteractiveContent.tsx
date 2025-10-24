import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Maximize2, Minimize2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface InteractiveContentProps {
  content: {
    url: string;
    title?: string;
    type: "iframe" | "embed";
    height?: number;
    allowFullscreen?: boolean;
    required_interaction_minutes?: number; // Optional: custom completion time
  };
  contentId: string;
  onComplete?: () => void;
}

export function InteractiveContent({ content, contentId, onComplete }: InteractiveContentProps) {
  const { user } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(content.height || 600);
  const [isCompleted, setIsCompleted] = useState(false);
  const [interactionTime, setInteractionTime] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const interactionStartTime = useRef<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Check completion status and load saved progress on mount
  useEffect(() => {
    const loadProgress = async () => {
      if (!user || !contentId) return;

      const { data } = await supabase
        .from("content_interactions")
        .select("is_completed, interaction_data")
        .eq("user_id", user.id)
        .eq("content_id", contentId)
        .single();

      if (data?.is_completed) {
        setIsCompleted(true);
      } else if (data?.interaction_data?.interaction_time) {
        // Resume from previous session
        const savedTime = data.interaction_data.interaction_time;
        setInteractionTime(savedTime);
        setHasInteracted(true);
        console.log('Restored interaction time:', savedTime);
      }
    };

    loadProgress();
  }, [user, contentId]);

  // Track interaction time
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (hasInteracted && !isCompleted && !document.hidden) {
      if (!interactionStartTime.current) {
        interactionStartTime.current = Date.now();
      }

      interval = setInterval(() => {
        if (interactionStartTime.current) {
          const sessionTime = (Date.now() - interactionStartTime.current) / 1000;
          const totalTime = interactionTime + sessionTime;
          setInteractionTime(totalTime);

          // Use configurable completion time or default to 5 minutes
          const requiredTime = (content.required_interaction_minutes || 5) * 60;
          if (totalTime >= requiredTime && !isCompleted) {
            handleContentComplete();
          }
        }
      }, 1000);
    } else {
      // Save accumulated time when paused
      if (interactionStartTime.current) {
        const sessionTime = (Date.now() - interactionStartTime.current) / 1000;
        setInteractionTime(prev => prev + sessionTime);
        interactionStartTime.current = null;
      }
    }

    return () => {
      if (interval) clearInterval(interval);
      // Save time on cleanup
      if (interactionStartTime.current) {
        const sessionTime = (Date.now() - interactionStartTime.current) / 1000;
        setInteractionTime(prev => prev + sessionTime);
        interactionStartTime.current = null;
      }
    };
  }, [hasInteracted, isCompleted, content.required_interaction_minutes]);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Visibility API - pause tracking when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && interactionStartTime.current) {
        console.log('Tab hidden - pausing interaction tracking');
        // Save accumulated time
        const sessionTime = (Date.now() - interactionStartTime.current) / 1000;
        setInteractionTime(prev => prev + sessionTime);
        interactionStartTime.current = null;
      } else if (!document.hidden && hasInteracted && !isCompleted) {
        console.log('Tab visible - resuming interaction tracking');
        // Resume tracking
        interactionStartTime.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [hasInteracted, isCompleted]);

  // Periodic progress saving (every 10 seconds while interacting)
  useEffect(() => {
    let saveInterval: NodeJS.Timeout;

    if (hasInteracted && !isCompleted && user) {
      saveInterval = setInterval(async () => {
        await supabase
          .from("content_interactions")
          .upsert({
            user_id: user.id,
            content_id: contentId,
            is_completed: false,
            interaction_data: {
              interaction_time: interactionTime,
              last_interaction: new Date().toISOString(),
            },
          });
        console.log('Saved interaction progress:', interactionTime);
      }, 10000); // Save every 10 seconds
    }

    return () => {
      if (saveInterval) clearInterval(saveInterval);
    };
  }, [hasInteracted, interactionTime, isCompleted, user, contentId]);

  const toggleFullscreen = () => {
    const container = document.getElementById(`interactive-${contentId}`);
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleInteraction = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
      // Record initial interaction
      recordInteraction({ type: "interaction_started" });
    }
  };

  const recordInteraction = async (interactionData: any) => {
    if (!user) return;

    await supabase
      .from("content_interactions")
      .upsert({
        user_id: user.id,
        content_id: contentId,
        is_completed: isCompleted,
        interaction_data: {
          ...interactionData,
          interaction_time: interactionTime,
          started_at: interactionStartTime.current ? new Date(interactionStartTime.current).toISOString() : null,
        },
      });
  };

  const handleContentComplete = async () => {
    if (!user || isCompleted) return;

    setIsCompleted(true);

    await supabase
      .from("content_interactions")
      .upsert({
        user_id: user.id,
        content_id: contentId,
        is_completed: true,
        interaction_data: {
          type: "completed",
          interaction_time: interactionTime,
          completed_at: new Date().toISOString(),
          started_at: interactionStartTime.current ? new Date(interactionStartTime.current).toISOString() : null,
        },
      });

    if (onComplete) onComplete();
  };

  const openInNewTab = () => {
    window.open(content.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      {content.title && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{content.title}</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={openInNewTab}
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            {content.allowFullscreen !== false && (
              <Button
                variant="outline"
                size="sm"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            )}
            {!isCompleted && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleContentComplete}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            )}
          </div>
        </div>
      )}

      <div
        id={`interactive-${contentId}`}
        className="relative bg-muted rounded-lg overflow-hidden"
        style={{ height: isFullscreen ? "100vh" : `${iframeHeight}px` }}
        onClick={handleInteraction}
        onFocus={handleInteraction}
      >
        <iframe
          ref={iframeRef}
          src={content.url}
          className="w-full h-full border-0"
          title={content.title || "Interactive Content"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen={content.allowFullscreen !== false}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
          onLoad={handleInteraction}
        />
      </div>

      {/* Status and Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Interactive content
            {hasInteracted && !isCompleted && (
              <span className="ml-2">
                • Interacted: {Math.floor(interactionTime / 60)}:{(interactionTime % 60).toFixed(0).padStart(2, '0')}
              </span>
            )}
          </span>
        </div>
        {isCompleted && (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950 px-3 py-1 rounded-lg">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Completed</span>
          </div>
        )}
      </div>

      {!isCompleted && (
        <p className="text-xs text-muted-foreground">
          💡 Interact with the content above. It will be marked complete after {content.required_interaction_minutes || 5} minutes of interaction, or click "Mark Complete" when done.
        </p>
      )}
    </div>
  );
}
