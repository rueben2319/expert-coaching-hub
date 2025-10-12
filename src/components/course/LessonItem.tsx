import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Trash2, Plus, Edit, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CreateContentDialog } from "./CreateContentDialog";
import { CreateLessonDialog } from "./CreateLessonDialog";
import { ContentItem } from "./ContentItem";

interface LessonItemProps {
  lesson: any;
  moduleId: string;
}

export function LessonItem({ lesson, moduleId }: LessonItemProps) {
  const [showCreateContent, setShowCreateContent] = useState(false);
  const [showEditLesson, setShowEditLesson] = useState(false);
  const [isContentOpen, setIsContentOpen] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("lessons")
        .delete()
        .eq("id", lesson.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-modules"] });
      toast({ title: "Lesson deleted" });
    },
  });

  const contentItems = lesson.lesson_content || [];
  const contentCount = contentItems.length;

  return (
    <>
      <Collapsible open={isContentOpen} onOpenChange={setIsContentOpen}>
        <div className="bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between p-3">
            <CollapsibleTrigger className="flex items-center gap-3 flex-1 text-left">
              <ChevronDown className={`h-4 w-4 transition-transform ${isContentOpen ? "" : "-rotate-90"}`} />
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{lesson.title}</p>
                {lesson.description && (
                  <p className="text-sm text-muted-foreground">{lesson.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {contentCount} content item{contentCount !== 1 ? "s" : ""}
                </p>
              </div>
            </CollapsibleTrigger>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowCreateContent(true)} className="flex items-center gap-1">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Content</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowEditLesson(true)} title="Edit Lesson">
                <Edit className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate()} title="Delete Lesson">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <CollapsibleContent>
            <div className="px-3 pb-3">
              {contentItems.length > 0 ? (
                <div className="space-y-2 ml-6">
                  {contentItems
                    .sort((a: any, b: any) => a.order_index - b.order_index)
                    .map((content: any) => (
                      <ContentItem
                        key={content.id}
                        content={content}
                        lessonId={lesson.id}
                      />
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4 ml-6">
                  No content yet. Click "+" to add content.
                </p>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <CreateContentDialog
        lessonId={lesson.id}
        open={showCreateContent}
        onOpenChange={setShowCreateContent}
      />

      <CreateLessonDialog
        moduleId={moduleId}
        open={showEditLesson}
        onOpenChange={setShowEditLesson}
        editLesson={lesson}
      />
    </>
  );
}
