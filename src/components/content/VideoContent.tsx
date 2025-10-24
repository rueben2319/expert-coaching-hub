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
    return `https://www.youtube.com/embed/${youtubeMatch[1]}?enablejsapi=1&origin=${window.location.origin}`;
  }

  // Vimeo
  const vimeoRegex = /vimeo\.com\/(?:.*\/)?(\d+)/;
  const vimeoMatch = url.match(vimeoRegex);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}?api=1`;
  }

  // If already an embed URL or direct video file, return as is
  return url;
};

const getVideoType = (url: string): 'youtube' | 'vimeo' | 'other' => {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/vimeo\.com/.test(url)) return 'vimeo';
  return 'other';
};

const isVideoFile = (url: string): boolean => {
  return /\.(mp4|webm|ogg|mov)$/i.test(url);
};

export function VideoContent({ content, contentId, onProgress, onComplete }: VideoContentProps) {
  const { user } = useAuth();
  const [hasStarted, setHasStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [watchTime, setWatchTime] = useState(0);
  const watchStartTime = useRef<number | null>(null);
  const totalWatchTime = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const embedUrl = getEmbedUrl(content.url);
  const isDirectVideo = isVideoFile(content.url);
  const videoType = getVideoType(content.url);

  // Check completion status on mount
  useEffect(() => {
    const checkCompletionStatus = async () => {
      if (!user || !contentId) return;

      try {
        const { data } = await supabase
          .from("content_interactions")
          .select("is_completed")
          .eq("user_id", user.id)
          .eq("content_id", contentId)
          .single();


        if (data?.is_completed) {
          setIsCompleted(true);
        }
      } catch (err) {
        console.error('Exception fetching content interaction:', err);
        // Continue without setting completion status
      }
    };

    checkCompletionStatus();
  }, [user, contentId]);

  // Listen for YouTube and Vimeo player events
  useEffect(() => {
    if (isDirectVideo) return;

    const handleMessage = (event: MessageEvent) => {
      // YouTube player events
      if (videoType === 'youtube') {
        try {
          let data = event.data;
          if (typeof data === 'string') {
            data = JSON.parse(data);
          }
          
          if (data.event === 'onStateChange') {
            console.log('YouTube state change:', data.info);
            // YouTube states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
            if (data.info === 1) {
              // Playing
              console.log('YouTube: Playing');
              setHasStarted(true);
              setIsPlaying(true);
            } else if (data.info === 2) {
              // Paused
              console.log('YouTube: Paused');
              setIsPlaying(false);
            } else if (data.info === 0) {
              // Ended
              console.log('YouTube: Ended');
              setIsPlaying(false);
              handleVideoComplete();
            }
          }
        } catch (e) {
          // Not a YouTube message
        }
      }

      // Vimeo player events
      if (videoType === 'vimeo') {
        try {
          let data = event.data;
          if (typeof data === 'string') {
            data = JSON.parse(data);
          }
          
          console.log('Vimeo event:', data.event);
          if (data.event === 'play') {
            console.log('Vimeo: Playing');
            setHasStarted(true);
            setIsPlaying(true);
          } else if (data.event === 'pause') {
            console.log('Vimeo: Paused');
            setIsPlaying(false);
          } else if (data.event === 'ended') {
            console.log('Vimeo: Ended');
            setIsPlaying(false);
            handleVideoComplete();
          }
        } catch (e) {
          // Not a Vimeo message
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Send ready message to enable events
    const iframe = iframeRef.current;
    if (iframe && iframe.contentWindow) {
      // For YouTube
      if (videoType === 'youtube') {
        setTimeout(() => {
          iframe.contentWindow?.postMessage('{"event":"listening"}', '*');
        }, 1000);
      }
      // For Vimeo
      if (videoType === 'vimeo') {
        setTimeout(() => {
          iframe.contentWindow?.postMessage('{"method":"addEventListener","value":"play"}', '*');
          iframe.contentWindow?.postMessage('{"method":"addEventListener","value":"pause"}', '*');
          iframe.contentWindow?.postMessage('{"method":"addEventListener","value":"ended"}', '*');
        }, 1000);
      }
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [isDirectVideo, videoType, isCompleted]);

  // Track watch time - only counts when video is actively playing
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isPlaying && !isCompleted) {
      // Start tracking from current moment
      if (!watchStartTime.current) {
        watchStartTime.current = Date.now();
      }

      interval = setInterval(() => {
        if (watchStartTime.current) {
          // Calculate time since last start
          const sessionTime = (Date.now() - watchStartTime.current) / 1000;
          // Add to total watch time
          const currentTotal = totalWatchTime.current + sessionTime;
          setWatchTime(currentTotal);

          // Mark as complete when 90% watched
          const estimatedDuration = content.duration ? content.duration * 60 : 600;
          const progressPercentage = (currentTotal / estimatedDuration) * 100;
          if (progressPercentage >= 90 && !isCompleted) {
            handleVideoComplete();
          }
        }
      }, 1000);
    } else {
      // Video paused or stopped - save accumulated time
      if (watchStartTime.current) {
        const sessionTime = (Date.now() - watchStartTime.current) / 1000;
        totalWatchTime.current += sessionTime;
        setWatchTime(totalWatchTime.current);
        watchStartTime.current = null;
      }
    }

    return () => {
      // Clear interval when effect re-runs or component unmounts
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      // Save accumulated time on cleanup if still tracking
      if (watchStartTime.current && isPlaying) {
        const sessionTime = (Date.now() - watchStartTime.current) / 1000;
        totalWatchTime.current += sessionTime;
        setWatchTime(totalWatchTime.current);
        watchStartTime.current = null;
      }
    };
  }, [isPlaying, isCompleted, content.duration]);

  const saveProgress = async (percentage: number, isComplete = false) => {
    if (!user || isCompleted) return;

    try {
      const { error } = await supabase
        .from("content_interactions")
        .upsert({
          user_id: user.id,
          content_id: contentId,
          is_completed: isComplete,
        });

      if (error) {
        console.error('Error saving progress:', error);
        // Continue without throwing - video still works
        return;
      }

      if (isComplete && onComplete) {
        onComplete();
      }
    } catch (err) {
      console.error('Exception saving progress:', err);
      // Continue without throwing - video still works
    }
  };

  const handleVideoStart = () => {
    setHasStarted(true);
    // Don't auto-start playing for embedded videos
  };

  const handleVideoPause = () => {
    setIsPlaying(false);
  };

  const handleVideoPlay = () => {
    setHasStarted(true);
    setIsPlaying(true);
  };

  const handleVideoResume = () => {
    setIsPlaying(true);
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
            ref={iframeRef}
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
            onPlay={handleVideoResume}
            onPause={handleVideoPause}
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
            {hasStarted && !isCompleted && (
              <span className="ml-2">
                • Watched: {Math.floor(watchTime / 60)}:{Math.floor(watchTime % 60).toString().padStart(2, '0')}
                {isPlaying && <span className="text-green-600 ml-1">▶</span>}
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
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            💡 Watch at least 90% of the video to mark it as complete. Watch time is tracked automatically when you play the video.
          </p>
          {hasStarted && (
            <div className="text-xs">
              <span className={isPlaying ? "text-green-600 font-medium" : "text-muted-foreground"}>
                {isPlaying ? "⏵ Playing - watch time counting" : "⏸ Paused - watch time stopped"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
