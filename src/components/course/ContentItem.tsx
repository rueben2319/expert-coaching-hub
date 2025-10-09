import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, FileText, Video, HelpCircle, Monitor, File } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CreateContentDialog } from "./CreateContentDialog";

interface ContentItemProps {
  content: any;
  lessonId: string;
}

export function ContentItem({ content, lessonId }: ContentItemProps) {
  const [showEditContent, setShowEditContent] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("lesson_content")
        .delete()
        .eq("id", content.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-modules"] });
      toast({ title: "Content deleted" });
    },
  });

  const getContentIcon = (type: string) => {
    switch (type) {
      case "text":
        return <FileText className="h-4 w-4" />;
      case "video":
        return <Video className="h-4 w-4" />;
      case "quiz":
        return <HelpCircle className="h-4 w-4" />;
      case "interactive":
        return <Monitor className="h-4 w-4" />;
      case "file":
        return <File className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getContentPreview = (content: any) => {
    switch (content.content_type) {
      case "text":
        const textContent = content.content_data?.text || content.content_data?.html || "Text content";
        return textContent.length > 100 ? textContent.substring(0, 100) + "..." : textContent;
      case "video":
        return content.content_data?.url || "No video URL";
      case "quiz":
        return content.content_data?.question || "No quiz question";
      case "interactive":
        return content.content_data?.url || "No interactive URL";
      case "file":
        return content.content_data?.filename || content.content_data?.url || "No file URL";
      default:
        return "Content";
    }
  };

  return (
    <>
      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-3">
          {getContentIcon(content.content_type)}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {content.content_type}
              </Badge>
              {content.is_required && (
                <Badge variant="outline" className="text-xs">
                  Required
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {getContentPreview(content)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowEditContent(true)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate()}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <CreateContentDialog
        lessonId={lessonId}
        open={showEditContent}
        onOpenChange={setShowEditContent}
        editContent={content}
      />
    </>
  );
}
