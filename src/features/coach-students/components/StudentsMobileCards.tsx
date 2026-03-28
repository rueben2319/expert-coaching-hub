import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { CoachStudent } from "@/features/coach-students/types";
import { Mail, MessageCircle } from "lucide-react";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((token) => token[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getStatusColor(status: CoachStudent["status"]) {
  return status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800";
}

interface StudentsMobileCardsProps {
  students: CoachStudent[];
}

export function StudentsMobileCards({ students }: StudentsMobileCardsProps) {
  return (
    <div className="grid gap-4 md:hidden">
      {students.map((student) => (
        <div key={student.id} className="bg-muted/30 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={student.avatar || undefined} alt={student.name} />
                <AvatarFallback>{getInitials(student.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{student.name}</p>
                <p className="text-xs text-muted-foreground">{student.email}</p>
              </div>
            </div>
            <Badge className={getStatusColor(student.status)}>{student.status}</Badge>
          </div>

          <div className="mt-3 space-y-2 text-sm">
            <p className="text-muted-foreground">Last active: {new Date(student.lastActive).toLocaleDateString()}</p>
            <p className="text-muted-foreground">Courses: {student.enrolledCourses.length}</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Progress</span>
                <span>{student.progress}%</span>
              </div>
              <Progress value={Math.max(student.progress, 5)} className="h-2" />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" variant="outline" className="flex-1">
              <Mail className="mr-2 h-4 w-4" />
              Email
            </Button>
            <Button size="sm" variant="outline" className="flex-1">
              <MessageCircle className="mr-2 h-4 w-4" />
              Message
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
