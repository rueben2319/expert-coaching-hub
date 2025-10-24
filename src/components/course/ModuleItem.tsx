import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Plus, Trash2, Edit } from "lucide-react";
import { LessonItem } from "./LessonItem";
import { CreateLessonDialog } from "./CreateLessonDialog";
import { CreateModuleDialog } from "./CreateModuleDialog";
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
  const [showEditModule, setShowEditModule] = useState(false);
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
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between p-4 gap-3">
            <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left min-w-0">
              <ChevronDown className={`h-5 w-5 transition-transform flex-shrink-0 ${isOpen ? "" : "-rotate-90"}`} />
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold truncate">{module.title}</h3>
                {module.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{module.description}</p>
                )}
              </div>
            </CollapsibleTrigger>
            <div className="flex gap-2 flex-shrink-0">
              <Button size="sm" onClick={() => setShowCreateLesson(true)}>
                <Plus className="h-4 w-4 mr-1" /> 
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowEditModule(true)}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate()}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CollapsibleContent>
            <div className="px-4 pb-4">
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
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <CreateLessonDialog
        moduleId={module.id}
        open={showCreateLesson}
        onOpenChange={setShowCreateLesson}
      />

      <CreateModuleDialog
        courseId={courseId}
        open={showEditModule}
        onOpenChange={setShowEditModule}
        editModule={module}
      />
    </>
  );
}
