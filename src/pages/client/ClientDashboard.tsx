import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/DashboardLayout";
import { BookOpen, User, Calendar, TrendingUp } from "lucide-react";

export default function ClientDashboard() {
  const { user } = useAuth();

  const navItems = [
    { label: "Dashboard", href: "/client" },
    { label: "My Courses", href: "/client/courses" },
    { label: "Schedule", href: "/client/schedule" },
    { label: "Progress", href: "/client/progress" },
  ];

  const sidebarSections = [
    {
      title: "Quick Links",
      items: [
        {
          icon: <BookOpen className="h-4 w-4" />,
          label: "Browse Courses",
          href: "/client/courses",
        },
        {
          icon: <Calendar className="h-4 w-4" />,
          label: "Upcoming Sessions",
          href: "/client/schedule",
        },
        {
          icon: <TrendingUp className="h-4 w-4" />,
          label: "My Progress",
          href: "/client/progress",
        },
        {
          icon: <User className="h-4 w-4" />,
          label: "Profile",
          href: "/client/profile",
        },
      ],
    },
  ];

  return (
    <DashboardLayout
      navItems={navItems}
      sidebarSections={sidebarSections}
      brandName="Insight Coach"
    >
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Welcome, {user?.user_metadata?.full_name || "Learner"}
        </h1>
        <p className="text-muted-foreground">Start your learning journey today</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>My Courses</CardTitle>
            <CardDescription>Browse and access your enrolled courses</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              No courses enrolled yet. Start exploring!
            </p>
            <Button className="w-full">Browse Courses</Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
              <User className="w-6 h-6 text-accent" />
            </div>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Manage your account settings</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Update your profile and preferences
            </p>
            <Button variant="outline" className="w-full">Edit Profile</Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>View your upcoming sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              No sessions scheduled
            </p>
            <Button variant="outline" className="w-full">View Calendar</Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
