import { 
  BookOpen, 
  Users, 
  Calendar, 
  BarChart3, 
  Video, 
  GraduationCap,
  Search,
  TrendingUp,
  Settings,
  UserCheck,
  Shield
} from "lucide-react";

// Coach Navigation Configuration
export const coachNavItems = [
  { label: "Dashboard", href: "/coach" },
  { label: "Courses", href: "/coach/courses" },
  { label: "Students", href: "/coach/students" },
  { label: "Sessions", href: "/coach/sessions" },
  { label: "Schedule", href: "/coach/schedule" },
  { label: "Analytics", href: "/coach/analytics" },
];

export const coachSidebarSections = [
  {
    title: "Course Management",
    items: [
      { icon: <BookOpen className="w-4 h-4" />, label: "My Courses", href: "/coach/courses" },
      { icon: <Users className="w-4 h-4" />, label: "Students", href: "/coach/students" },
    ],
  },
  {
    title: "Live Teaching",
    items: [
      { icon: <Video className="w-4 h-4" />, label: "Live Sessions", href: "/coach/sessions" },
      { icon: <Calendar className="w-4 h-4" />, label: "Schedule", href: "/coach/schedule" },
    ],
  },
  {
    title: "Analytics",
    items: [
      { icon: <BarChart3 className="w-4 h-4" />, label: "Performance", href: "/coach/analytics" },
    ],
  },
];

// Client Navigation Configuration
export const clientNavItems = [
  { label: "Dashboard", href: "/client" },
  { label: "Browse Courses", href: "/client/courses" },
  { label: "My Courses", href: "/client/my-courses" },
  { label: "Progress", href: "/client/progress" },
];

export const clientSidebarSections = [
  {
    title: "Learning",
    items: [
      { icon: <Search className="w-4 h-4" />, label: "Browse Courses", href: "/client/courses" },
      { icon: <BookOpen className="w-4 h-4" />, label: "My Courses", href: "/client/my-courses" },
      { icon: <TrendingUp className="w-4 h-4" />, label: "Progress", href: "/client/progress" },
    ],
  },
];

// Admin Navigation Configuration
export const adminNavItems = [
  { label: "Dashboard", href: "/admin" },
  { label: "Users", href: "/admin/users" },
  { label: "Courses", href: "/admin/courses" },
  { label: "Analytics", href: "/admin/analytics" },
  { label: "Settings", href: "/admin/settings" },
];

export const adminSidebarSections = [
  {
    title: "Management",
    items: [
      { icon: <UserCheck className="w-4 h-4" />, label: "Users", href: "/admin/users" },
      { icon: <GraduationCap className="w-4 h-4" />, label: "Courses", href: "/admin/courses" },
      { icon: <BarChart3 className="w-4 h-4" />, label: "Analytics", href: "/admin/analytics" },
      { icon: <Settings className="w-4 h-4" />, label: "Settings", href: "/admin/settings" },
    ],
  },
];

// Profile Navigation (role-based)
export const getProfileNavItems = (role: string) => {
  switch (role) {
    case "coach":
      return coachNavItems;
    case "client":
      return clientNavItems;
    case "admin":
      return adminNavItems;
    default:
      return [];
  }
};

export const getProfileSidebarSections = (role: string) => {
  switch (role) {
    case "coach":
      return coachSidebarSections;
    case "client":
      return clientSidebarSections;
    case "admin":
      return adminSidebarSections;
    default:
      return [];
  }
};
