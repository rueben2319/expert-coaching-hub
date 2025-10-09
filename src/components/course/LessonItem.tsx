import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Trash2, Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CreateContentDialog } from "./CreateContentDialog";

interface LessonItemProps {
  lesson: any;
  moduleId: string;
}

export function LessonItem({ lesson, moduleId }: LessonItemProps) {
  const [showCreateContent, setShowCreateContent] = useState(false);
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

  const contentCount = lesson.lesson_content?.[0]?.count || 0;

  return (
    <>
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3">
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
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowCreateContent(true)}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate()}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <CreateContentDialog
        lessonId={lesson.id}
        open={showCreateContent}
        onOpenChange={setShowCreateContent}
      />
    </>
  );
}
