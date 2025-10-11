import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Play, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface VideoContentProps {
  content: {
    url: string;
    title?: string;
    duration?: number;
    thumbnail?: string;
  };
  contentId: string;
  onProgress?: (percentage: number) => void;
  onComplete?: () => void;
}

// Helper function to convert YouTube URL to embed URL
const getEmbedUrl = (url: string): string => {
  // YouTube
  const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}?enablejsapi=1`;
  }

  // Vimeo
  const vimeoRegex = /vimeo\.com\/(?:.*\/)?(\d+)/;
  const vimeoMatch = url.match(vimeoRegex);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  // If already an embed URL or direct video file, return as is
  return url;
};

const isVideoFile = (url: string): boolean => {
  return /\.(mp4|webm|ogg|mov)$/i.test(url);
};

export function VideoContent({ content, contentId, onProgress, onComplete }: VideoContentProps) {
  const { user } = useAuth();
  const [hasStarted, setHasStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [watchTime, setWatchTime] = useState(0);
  const watchStartTime = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const embedUrl = getEmbedUrl(content.url);
  const isDirectVideo = isVideoFile(content.url);

  // Check completion status on mount
  useEffect(() => {
    const checkCompletionStatus = async () => {
      if (!user || !contentId) return;

      const { data } = await supabase
        .from("content_interactions")
        .select("is_completed, interaction_data")
        .eq("user_id", user.id)
        .eq("content_id", contentId)
        .single();

      if (data?.is_completed) {
        setIsCompleted(true);
      }
    };

    checkCompletionStatus();
  }, [user, contentId]);

  // Track watch time for embedded videos
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (hasStarted && !isCompleted && !isDirectVideo) {
      watchStartTime.current = Date.now();
      interval = setInterval(() => {
        if (watchStartTime.current) {
          const currentWatchTime = (Date.now() - watchStartTime.current) / 1000; // in seconds
          setWatchTime(currentWatchTime);

          // Estimate progress based on duration (if available) or assume 10 minutes
          const estimatedDuration = content.duration || 600; // 10 minutes default
          const progressPercentage = Math.min((currentWatchTime / estimatedDuration) * 100, 100);

          // Mark as complete when 90% watched
          if (progressPercentage >= 90 && !isCompleted) {
            handleVideoComplete();
          }
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [hasStarted, isCompleted, isDirectVideo, content.duration]);

  const saveProgress = async (percentage: number, isComplete = false) => {
    if (!user || isCompleted) return;

    const interactionData = {
      progress: percentage,
      watch_time: watchTime,
      started_at: watchStartTime.current ? new Date(watchStartTime.current).toISOString() : null,
      completed_at: isComplete ? new Date().toISOString() : null,
      is_embedded: !isDirectVideo,
    };

    await supabase
      .from("content_interactions")
      .upsert({
        user_id: user.id,
        content_id: contentId,
        is_completed: isComplete,
        interaction_data: interactionData,
      });

    if (isComplete && onComplete) {
      onComplete();
    }
  };

  const handleVideoStart = () => {
    setHasStarted(true);
  };

  const handleVideoComplete = async () => {
    setIsCompleted(true);
    await saveProgress(100, true);
  };

  // Handle direct video progress
  const handleDirectVideoProgress = () => {
    if (!videoRef.current || !isDirectVideo) return;

    const video = videoRef.current;
    const progressPercentage = (video.currentTime / video.duration) * 100;

    if (progressPercentage >= 90 && !isCompleted) {
      handleVideoComplete();
    }
  };

  const handleMarkWatched = async () => {
    await handleVideoComplete();
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
              <ExternalLink className="h-4 w-4 mr-2" />
              Watch on Platform
            </Button>
            {!isCompleted && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkWatched}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark as Watched
              </Button>
            )}
          </div>
        </div>
      )}

      {!isDirectVideo ? (
        // Embedded video (YouTube/Vimeo)
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          <iframe
            src={embedUrl}
            className="w-full h-full border-0"
            title={content.title || "Video Content"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            onLoad={handleVideoStart}
          />
        </div>
      ) : (
        // Direct video file
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          <video
            ref={videoRef}
            src={content.url}
            className="w-full h-full"
            controls
            onPlay={handleVideoStart}
            onTimeUpdate={handleDirectVideoProgress}
            onEnded={handleVideoComplete}
            title={content.title || "Video Content"}
          />
        </div>
      )}

      {/* Video Info and Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Play className="h-4 w-4" />
          <span>
            {content.duration ? `${content.duration} minutes` : "Video content"}
            {!isDirectVideo && hasStarted && !isCompleted && (
              <span className="ml-2">
                • Watched: {Math.floor(watchTime / 60)}:{(watchTime % 60).toFixed(0).padStart(2, '0')}
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
          💡 {isDirectVideo
            ? "Watch at least 90% of the video to mark it as complete."
            : "Keep this tab open while watching to track progress automatically, or click 'Mark as Watched' when done."
          }
        </p>
      )}
    </div>
  );
}
