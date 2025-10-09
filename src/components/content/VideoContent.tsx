import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Play } from "lucide-react";
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

export function VideoContent({ content, contentId, onProgress }: VideoContentProps) {
  const { user } = useAuth();
  const [hasStarted, setHasStarted] = useState(false);
  const embedUrl = getEmbedUrl(content.url);
  const isDirectVideo = isVideoFile(content.url);

  // Mark video as started and track interaction
  useEffect(() => {
    if (hasStarted && user) {
      saveProgress(10); // Mark as started
    }
  }, [hasStarted, user]);

  const saveProgress = async (percentage: number) => {
    if (!user) return;

    await supabase
      .from("content_interactions")
      .upsert({
        user_id: user.id,
        content_id: contentId,
        is_completed: percentage >= 90,
        interaction_data: { 
          progress: percentage, 
          started_at: new Date().toISOString() 
        },
      });

    if (percentage >= 90 && onProgress) {
      onProgress(100);
    }
  };

  const handleVideoStart = () => {
    setHasStarted(true);
  };

  const handleMarkWatched = async () => {
    await saveProgress(100);
  };

  const openInNewTab = () => {
    window.open(content.url, "_blank", "noopener,noreferrer");
  };

  return (
    <Card>
      {content.title && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{content.title}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={openInNewTab}
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Watch on Platform
            </Button>
          </div>
        </CardHeader>
      )}
      <CardContent className="space-y-4">
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

        {/* Video Info and Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Play className="h-4 w-4" />
            <span>
              {content.duration ? `${content.duration} minutes` : "Video content"}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkWatched}
          >
            Mark as Watched
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          💡 Tip: Watch the entire video and click "Mark as Watched" to track your progress.
        </p>
      </CardContent>
    </Card>
  );
}
