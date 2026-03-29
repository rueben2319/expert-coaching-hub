import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

interface StudentsDesktopTableProps {
  students: CoachStudent[];
}

export function StudentsDesktopTable({ students }: StudentsDesktopTableProps) {
  return (
    <div className="hidden md:block rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Courses</TableHead>
            <TableHead>Last Active</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student) => (
            <TableRow key={student.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={student.avatar || undefined} alt={student.name} />
                    <AvatarFallback>{getInitials(student.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{student.name}</p>
                    <p className="text-xs text-muted-foreground">{student.email}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge className={getStatusColor(student.status)}>{student.status}</Badge>
              </TableCell>
              <TableCell>{student.enrolledCourses.length}</TableCell>
              <TableCell>{new Date(student.lastActive).toLocaleDateString()}</TableCell>
              <TableCell>
                <div className="space-y-1 min-w-28">
                  <div className="text-xs text-muted-foreground">{student.progress}%</div>
                  <Progress value={Math.max(student.progress, 5)} className="h-2" />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-2">
                  <Button size="sm" variant="outline">
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline">
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline">View Profile</Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
