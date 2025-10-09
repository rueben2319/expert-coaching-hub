import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/DashboardLayout";
import { BookOpen, Plus, Users, BarChart3, Calendar, Video } from "lucide-react";

export default function CoachDashboard() {
  const { user } = useAuth();

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
        {
          icon: <Plus className="h-4 w-4" />,
          label: "Create Course",
          href: "/coach/courses/new",
        },
        {
          icon: <BookOpen className="h-4 w-4" />,
          label: "My Courses",
          href: "/coach/courses",
        },
        {
          icon: <Video className="h-4 w-4" />,
          label: "Live Sessions",
          href: "/coach/sessions",
        },
      ],
    },
    {
      title: "Students",
      items: [
        {
          icon: <Users className="h-4 w-4" />,
          label: "All Students",
          href: "/coach/students",
        },
        {
          icon: <Calendar className="h-4 w-4" />,
          label: "Schedule",
          href: "/coach/schedule",
        },
        {
          icon: <BarChart3 className="h-4 w-4" />,
          label: "Analytics",
          href: "/coach/analytics",
        },
      ],
    },
  ];

  return (
    <DashboardLayout
      navItems={navItems}
      sidebarSections={sidebarSections}
      brandName="Coach Studio"
    >
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Coach Dashboard
          </h1>
          <p className="text-muted-foreground">Create and manage your courses</p>
        </div>
        <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Create Course
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>My Courses</CardTitle>
            <CardDescription>Manage your course content</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2 text-primary">0</div>
            <p className="text-sm text-muted-foreground">Courses created</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-accent" />
            </div>
            <CardTitle>Students</CardTitle>
            <CardDescription>View your enrolled students</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2 text-accent">0</div>
            <p className="text-sm text-muted-foreground">Total students</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Analytics</CardTitle>
            <CardDescription>Track your performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2 text-primary">0</div>
            <p className="text-sm text-muted-foreground">Total views</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
