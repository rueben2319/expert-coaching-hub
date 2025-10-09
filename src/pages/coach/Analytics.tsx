import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { BookOpen, Plus, Users, BarChart3, Calendar, Video, TrendingUp, TrendingDown, Eye, Clock } from "lucide-react";

export default function Analytics() {
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

  // Mock analytics data
  const stats = [
    {
      title: "Total Students",
      value: "142",
      change: "+12%",
      trend: "up",
      icon: Users,
      description: "vs last month"
    },
    {
      title: "Course Completion Rate",
      value: "78%",
      change: "+5%",
      trend: "up",
      icon: BookOpen,
      description: "average across all courses"
    },
    {
      title: "Total Revenue",
      value: "$12,450",
      change: "+23%",
      trend: "up",
      icon: TrendingUp,
      description: "this month"
    },
    {
      title: "Session Attendance",
      value: "89%",
      change: "-3%",
      trend: "down",
      icon: Video,
      description: "average attendance rate"
    }
  ];

  const coursePerformance = [
    {
      name: "JavaScript Fundamentals",
      students: 45,
      completion: 85,
      rating: 4.8,
      revenue: "$4,500"
    },
    {
      name: "React Masterclass",
      students: 32,
      completion: 72,
      rating: 4.6,
      revenue: "$3,200"
    },
    {
      name: "Web Development Bootcamp",
      students: 28,
      completion: 68,
      rating: 4.9,
      revenue: "$2,800"
    },
    {
      name: "Node.js Backend",
      students: 37,
      completion: 79,
      rating: 4.7,
      revenue: "$3,700"
    }
  ];

  const recentActivity = [
    {
      type: "enrollment",
      message: "5 new students enrolled in JavaScript Fundamentals",
      time: "2 hours ago"
    },
    {
      type: "completion",
      message: "Alice Johnson completed React Masterclass",
      time: "4 hours ago"
    },
    {
      type: "session",
      message: "Live session 'React Hooks Deep Dive' completed",
      time: "1 day ago"
    },
    {
      type: "review",
      message: "New 5-star review on Web Development Bootcamp",
      time: "2 days ago"
    }
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "enrollment": return <Users className="h-4 w-4 text-blue-500" />;
      case "completion": return <BookOpen className="h-4 w-4 text-green-500" />;
      case "session": return <Video className="h-4 w-4 text-purple-500" />;
      case "review": return <BarChart3 className="h-4 w-4 text-yellow-500" />;
      default: return <Eye className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <DashboardLayout
      navItems={navItems}
      sidebarSections={sidebarSections}
      brandName="Coach Studio"
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Track your coaching performance and student engagement</p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="bg-muted/30 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <div className="flex items-center gap-1 text-sm">
                      {stat.trend === "up" ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                      <span className={stat.trend === "up" ? "text-green-500" : "text-red-500"}>
                        {stat.change}
                      </span>
                      <span className="text-muted-foreground">{stat.description}</span>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Course Performance */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Course Performance</h2>
            <div className="space-y-3">
              {coursePerformance.map((course, index) => (
                <div key={index} className="bg-muted/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">{course.name}</h3>
                    <span className="text-sm font-medium text-green-600">{course.revenue}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Students</p>
                      <p className="font-medium">{course.students}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Completion</p>
                      <p className="font-medium">{course.completion}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Rating</p>
                      <p className="font-medium">⭐ {course.rating}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${course.completion}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Recent Activity</h2>
            <div className="space-y-3">
              {recentActivity.map((activity, index) => (
                <div key={index} className="bg-muted/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    {getActivityIcon(activity.type)}
                    <div className="flex-1">
                      <p className="text-sm">{activity.message}</p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {activity.time}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Student Engagement Chart Placeholder */}
        <div className="bg-muted/30 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Student Engagement Over Time</h2>
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-muted-foreground/20 rounded-lg">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Chart visualization would go here</p>
              <p className="text-sm text-muted-foreground">Integration with charting library needed</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
