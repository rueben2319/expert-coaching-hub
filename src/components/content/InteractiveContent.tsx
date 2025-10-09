import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Maximize2, Minimize2 } from "lucide-react";

interface InteractiveContentProps {
  content: {
    url: string;
    title?: string;
    type: "iframe" | "embed";
    height?: number;
    allowFullscreen?: boolean;
  };
  contentId: string;
}

export function InteractiveContent({ content, contentId }: InteractiveContentProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(content.height || 600);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    const container = document.getElementById(`interactive-${contentId}`);
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
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
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent>
        <div
          id={`interactive-${contentId}`}
          className="relative bg-muted rounded-lg overflow-hidden"
          style={{ height: isFullscreen ? "100vh" : `${iframeHeight}px` }}
        >
          <iframe
            src={content.url}
            className="w-full h-full border-0"
            title={content.title || "Interactive Content"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen={content.allowFullscreen !== false}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Interactive content loaded from: {new URL(content.url).hostname}
        </p>
      </CardContent>
    </Card>
  );
}
