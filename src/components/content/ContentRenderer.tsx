import { TextContent } from "./TextContent";
import { VideoContent } from "./VideoContent";
import { QuizContent } from "./QuizContent";
import { InteractiveContent } from "./InteractiveContent";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ContentRendererProps {
  content: {
    id: string;
    content_type: "text" | "video" | "quiz" | "interactive" | "file";
    content_data: any;
  };
  onProgress?: (percentage: number) => void;
  onComplete?: () => void;
}

export function ContentRenderer({ content, onProgress, onComplete }: ContentRendererProps) {
  switch (content.content_type) {
    case "text":
      return <TextContent content={content.content_data} />;

    case "video":
      return (
        <VideoContent
          content={content.content_data}
          contentId={content.id}
          onProgress={onProgress}
        />
      );

    case "quiz":
      return (
        <QuizContent
          content={content.content_data}
          contentId={content.id}
          onComplete={onComplete}
        />
      );

    case "interactive":
      return <InteractiveContent content={content.content_data} contentId={content.id} />;

    case "file":
      return (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium">{content.content_data.filename}</p>
                {content.content_data.size && (
                  <p className="text-sm text-muted-foreground">
                    {(content.content_data.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
              </div>
              <Button asChild>
                <a
                  href={content.content_data.url}
                  download={content.content_data.filename}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      );

    default:
      return (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Unsupported content type: {content.content_type}
            </p>
          </CardContent>
        </Card>
      );
  }
}
