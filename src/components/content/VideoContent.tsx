import { useState, useRef, useEffect } from "react";
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

  // Check completion status and load saved progress on mount
  useEffect(() => {
    const loadProgress = async () => {
      if (!user || !contentId) return;

      try {
        const { data } = await supabase
          .from("content_interactions")
          .select("is_completed, interaction_data")
          .eq("user_id", user.id)
          .eq("content_id", contentId)
          .maybeSingle();

        if (data?.is_completed) {
          setIsCompleted(true);
        } else if (data?.interaction_data) {
          // Restore previous watch time
          const interactionData = data.interaction_data as { watch_time?: number };
          if (interactionData.watch_time) {
            const savedWatchTime = interactionData.watch_time;
            setWatchTime(savedWatchTime);
            totalWatchTime.current = savedWatchTime;
            console.log('Restored watch time:', savedWatchTime);
          }
        }
      } catch (err) {
        console.error('Exception fetching content interaction:', err);
        // Continue without setting completion status
      }
    };

    loadProgress();
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

  // Periodic progress saving (every 10 seconds while playing)
  useEffect(() => {
    let saveInterval: NodeJS.Timeout;

    if (isPlaying && !isCompleted && user) {
      saveInterval = setInterval(() => {
        const estimatedDuration = content.duration ? content.duration * 60 : 600;
        const progressPercentage = (watchTime / estimatedDuration) * 100;
        saveProgress(progressPercentage);
      }, 10000); // Save every 10 seconds
    }

    return () => {
      if (saveInterval) clearInterval(saveInterval);
    };
  }, [isPlaying, watchTime, isCompleted, user, content.duration]);

  // Fallback heartbeat tracking for embedded videos (YouTube/Vimeo)
  // This ensures tracking continues even if postMessage events don't fire
  useEffect(() => {
    let heartbeatInterval: NodeJS.Timeout;

    if (!isDirectVideo && hasStarted && !isCompleted) {
      heartbeatInterval = setInterval(() => {
        const iframe = iframeRef.current;
        if (iframe) {
          // Check if iframe is visible in viewport
          const rect = iframe.getBoundingClientRect();
          const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
          
          if (isVisible && !document.hidden) {
            // Assume video is playing if visible and tab is active
            // Add 30 seconds to watch time as fallback
            setWatchTime(prev => {
              const newTime = prev + 30;
              totalWatchTime.current = newTime;
              return newTime;
            });
            console.log('Fallback tracking: +30s');
          }
        }
      }, 30000); // Every 30 seconds
    }

    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, [isDirectVideo, hasStarted, isCompleted]);

  // Visibility API - pause tracking when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isPlaying) {
        console.log('Tab hidden - pausing tracking');
        setIsPlaying(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPlaying]);

  const saveProgress = async (percentage: number, isComplete = false) => {
    if (!user || isCompleted) {
      console.log('⏭️ Skipping save:', { hasUser: !!user, isCompleted });
      return;
    }

    try {
      const estimatedDuration = content.duration ? content.duration * 60 : 600;
      console.log('💾 Saving progress:', {
        percentage: percentage.toFixed(1),
        isComplete,
        watchTime: watchTime.toFixed(1),
        estimatedDuration,
        contentId
      });
      
      const { data, error } = await supabase
        .from("content_interactions")
        .upsert({
          user_id: user.id,
          content_id: contentId,
          is_completed: isComplete,
          interaction_data: {
            watch_time: watchTime,
            last_position: percentage,
            estimated_duration: estimatedDuration,
            video_type: videoType,
            last_updated: new Date().toISOString(),
          },
        }, {
          onConflict: 'user_id,content_id'
        })
        .select();

      if (error) {
        console.error('❌ Error saving progress:', error);
        // Continue without throwing - video still works
        return;
      }

      console.log('✅ Progress saved:', data);

      if (isComplete && onComplete) {
        console.log('📢 Calling onComplete callback');
        onComplete();
      }
    } catch (err) {
      console.error('💥 Exception saving progress:', err);
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
    console.log('🎬 handleVideoComplete called');
    console.log('Current state:', { isCompleted, watchTime, user: !!user, contentId });
    
    if (isCompleted) {
      console.log('⚠️ Already completed, skipping');
      return;
    }
    
    setIsCompleted(true);
    console.log('💾 Saving progress with completion...');
    await saveProgress(100, true);
    console.log('✅ Video completion saved');
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

  return (
    <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
      {!isDirectVideo ? (
        <iframe
          ref={iframeRef}
          src={embedUrl}
          className="w-full h-full border-0"
          title={content.title || "Video Content"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          onLoad={handleVideoStart}
        />
      ) : (
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
      )}
    </div>
  );
}
