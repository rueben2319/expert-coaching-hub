import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { LessonItem } from "./LessonItem";
import { CreateLessonDialog } from "./CreateLessonDialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ModuleItemProps {
  module: any;
  courseId: string;
}

export function ModuleItem({ module, courseId }: ModuleItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateLesson, setShowCreateLesson] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("course_modules")
        .delete()
        .eq("id", module.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-modules", courseId] });
      toast({ title: "Module deleted" });
    },
  });

  return (
    <>
      <Card>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left">
                <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                <div className="flex-1">
                  <CardTitle className="text-lg">{module.title}</CardTitle>
                  {module.description && (
                    <p className="text-sm text-muted-foreground mt-1">{module.description}</p>
                  )}
                </div>
              </CollapsibleTrigger>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setShowCreateLesson(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Lesson
                </Button>
                <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate()}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              {module.lessons && module.lessons.length > 0 ? (
                <div className="space-y-2">
                  {module.lessons.map((lesson: any) => (
                    <LessonItem key={lesson.id} lesson={lesson} moduleId={module.id} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No lessons yet. Click "Add Lesson" to create one.
                </p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <CreateLessonDialog
        moduleId={module.id}
        open={showCreateLesson}
        onOpenChange={setShowCreateLesson}
      />
    </>
  );
}
