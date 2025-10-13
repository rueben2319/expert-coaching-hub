import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/DashboardLayout";
import { BookOpen, Users, Shield, Settings, BarChart3, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";


export default function AdminDashboard() {
  const { user } = useAuth();

  const navItems = [
    { label: "Dashboard", href: "/admin" },
    { label: "Users", href: "/admin/users" },
    { label: "Courses", href: "/admin/courses" },
    { label: "Settings", href: "/admin/settings" },
  ];

  const sidebarSections = [
    {
      title: "Management",
      items: [
        {
          icon: <Users className="h-4 w-4" />,
          label: "User Management",
          href: "/admin/users",
        },
        {
          icon: <BookOpen className="h-4 w-4" />,
          label: "Course Management",
          href: "/admin/courses",
        },
        {
          icon: <Shield className="h-4 w-4" />,
          label: "Roles & Permissions",
          href: "/admin/roles",
        },
      ],
    },
    {
      title: "System",
      items: [
        {
          icon: <BarChart3 className="h-4 w-4" />,
          label: "Analytics",
          href: "/admin/analytics",
        },
        {
          icon: <Settings className="h-4 w-4" />,
          label: "System Settings",
          href: "/admin/settings",
        },
        {
          icon: <AlertCircle className="h-4 w-4" />,
          label: "Reports",
          href: "/admin/reports",
        },
      ],
    },
  ];

  return (
    <DashboardLayout
      navItems={navItems}
      sidebarSections={sidebarSections}
      brandName="Admin Panel"
    >
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground">Monitor and manage platform activity</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Total Users</CardTitle>
            <CardDescription>Registered platform users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2 text-primary">0</div>
            <p className="text-sm text-muted-foreground">Active users</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
              <BookOpen className="w-6 h-6 text-accent" />
            </div>
            <CardTitle>Total Courses</CardTitle>
            <CardDescription>Published courses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2 text-accent">0</div>
            <p className="text-sm text-muted-foreground">Courses available</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Manage user roles and access</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">Manage Users</Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
