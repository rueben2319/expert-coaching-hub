import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/DashboardLayout";
import { BookOpen, Plus, Users, BarChart3, Calendar, Video, Search, Mail, MessageCircle } from "lucide-react";
import { useState } from "react";

export default function Students() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  const navItems = [
    { label: "Dashboard", href: "/coach" },
    { label: "My Courses", href: "/coach/courses" },
    { label: "Students", href: "/coach/students" },
    { label: "Analytics", href: "/coach/analytics" },
  ];

  const sidebarSections = [
    {
      title: "Course Management",
      items: [
        { icon: <Plus className="h-4 w-4" />, label: "Create Course", href: "/coach/courses/create" },
        { icon: <BookOpen className="h-4 w-4" />, label: "My Courses", href: "/coach/courses" },
        { icon: <Video className="h-4 w-4" />, label: "Live Sessions", href: "/coach/sessions" },
      ],
    },
    {
      title: "Students",
      items: [
        { icon: <Users className="h-4 w-4" />, label: "All Students", href: "/coach/students" },
        { icon: <Calendar className="h-4 w-4" />, label: "Schedule", href: "/coach/schedule" },
      ],
    },
    {
      title: "Analytics",
      items: [
        { icon: <BarChart3 className="h-4 w-4" />, label: "Analytics", href: "/coach/analytics" },
      ],
    },
  ];

  // Mock students data
  const students = [
    {
      id: 1,
      name: "Alice Johnson",
      email: "alice@example.com",
      avatar: "AJ",
      enrolledCourses: ["JavaScript Fundamentals", "React Masterclass"],
      progress: 75,
      lastActive: "2 hours ago",
      status: "active"
    },
    {
      id: 2,
      name: "Bob Smith",
      email: "bob@example.com",
      avatar: "BS",
      enrolledCourses: ["Web Development Bootcamp"],
      progress: 45,
      lastActive: "1 day ago",
      status: "active"
    },
    {
      id: 3,
      name: "Carol Davis",
      email: "carol@example.com",
      avatar: "CD",
      enrolledCourses: ["JavaScript Fundamentals", "Node.js Backend"],
      progress: 90,
      lastActive: "5 minutes ago",
      status: "active"
    },
    {
      id: 4,
      name: "David Wilson",
      email: "david@example.com",
      avatar: "DW",
      enrolledCourses: ["React Masterclass"],
      progress: 20,
      lastActive: "1 week ago",
      status: "inactive"
    }
  ];

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "inactive": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return "bg-green-500";
    if (progress >= 60) return "bg-blue-500";
    if (progress >= 40) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <DashboardLayout
      navItems={navItems}
      sidebarSections={sidebarSections}
      brandName="Coach Studio"
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Students</h1>
            <p className="text-muted-foreground">Manage and track your students' progress</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          {filteredStudents.map((student) => (
            <div key={student.id} className="bg-muted/30 rounded-lg p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center font-semibold text-primary">
                    {student.avatar}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{student.name}</h3>
                      <Badge className={getStatusColor(student.status)}>
                        {student.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{student.email}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Last active: {student.lastActive}</span>
                      <span>{student.enrolledCourses.length} courses</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Overall Progress</span>
                      <span className="font-medium">{student.progress}%</span>
                    </div>
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${getProgressColor(student.progress)}`}
                        style={{ width: `${student.progress}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </Button>
                    <Button variant="outline" size="sm">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Message
                    </Button>
                    <Button variant="outline" size="sm">
                      View Profile
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-medium mb-2">Enrolled Courses:</h4>
                <div className="flex flex-wrap gap-2">
                  {student.enrolledCourses.map((course, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {course}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredStudents.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? "No students found" : "No students yet"}
            </h3>
            <p className="text-muted-foreground">
              {searchTerm 
                ? "Try adjusting your search terms" 
                : "Students will appear here when they enroll in your courses"
              }
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
