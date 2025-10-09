import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ModuleItem } from "./ModuleItem";
import { CreateModuleDialog } from "./CreateModuleDialog";

interface CourseCurriculumProps {
  courseId: string;
}

export function CourseCurriculum({ courseId }: CourseCurriculumProps) {
  const [showCreateModule, setShowCreateModule] = useState(false);

  const { data: modules, isLoading } = useQuery({
    queryKey: ["course-modules", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_modules")
        .select(`
          *,
          lessons(
            *,
            lesson_content(*)
          )
        `)
        .eq("course_id", courseId)
        .order("order_index", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="text-center py-12">Loading curriculum...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Course Curriculum</h2>
        <Button onClick={() => setShowCreateModule(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Module
        </Button>
      </div>

      {modules && modules.length > 0 ? (
        <div className="space-y-4">
          {modules.map((module) => (
            <ModuleItem key={module.id} module={module} courseId={courseId} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No modules yet</p>
          <Button onClick={() => setShowCreateModule(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create First Module
          </Button>
        </div>
      )}

      <CreateModuleDialog
        courseId={courseId}
        open={showCreateModule}
        onOpenChange={setShowCreateModule}
      />
    </div>
  );
}
