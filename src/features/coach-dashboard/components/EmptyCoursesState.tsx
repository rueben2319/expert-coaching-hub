import { Button } from "@/components/ui/button";
import { BookOpen, Plus } from "lucide-react";

type EmptyCoursesStateProps = {
  onCreateCourse: () => void;
};

export function EmptyCoursesState({ onCreateCourse }: EmptyCoursesStateProps) {
  return (
    <div className="mt-8 text-center py-12">
      <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
      <p className="text-muted-foreground mb-4">Create your first course to start coaching students</p>
      <Button onClick={onCreateCourse}>
        <Plus className="w-4 h-4 mr-2" />
        Create Your First Course
      </Button>
    </div>
  );
}
