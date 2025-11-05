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
  Shield,
  MessageCircle,
  Wallet,
  ArrowDownToLine,
  CreditCard
} from "lucide-react";

// Coach Sidebar Configuration
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
    title: "Analytics & Billing",
    items: [
      { icon: <BarChart3 className="w-4 h-4" />, label: "Performance", href: "/coach/analytics" },
      { icon: <ArrowDownToLine className="w-4 h-4" />, label: "Withdrawals", href: "/coach/withdrawals" },
      { icon: <Shield className="w-4 h-4" />, label: "Billing", href: "/coach/billing" },
      { icon: <Settings className="w-4 h-4" />, label: "Settings", href: "/coach/settings" },
    ],
  },
];

// Client Sidebar Configuration
export const clientSidebarSections = [
  {
    title: "Learning",
    items: [
      { icon: <Search className="w-4 h-4" />, label: "Explore", href: "/client/courses" },
      { icon: <BookOpen className="w-4 h-4" />, label: "My Courses", href: "/client/my-courses" },
      { icon: <BarChart3 className="w-4 h-4" />, label: "Analytics", href: "/client/analytics" },
    ],
  },
  {
    title: "Sessions",
    items: [
      { icon: <MessageCircle className="w-4 h-4" />, label: "My Sessions", href: "/client/sessions" },
    ],
  },
];

// Admin Sidebar Configuration
export const adminSidebarSections = [
  {
    title: "Management",
    items: [
      { icon: <BarChart3 className="w-4 h-4" />, label: "Dashboard", href: "/admin" },
      { icon: <UserCheck className="w-4 h-4" />, label: "Users", href: "/admin/users" },
      { icon: <GraduationCap className="w-4 h-4" />, label: "Courses", href: "/admin/courses" },
      { icon: <CreditCard className="w-4 h-4" />, label: "Transactions", href: "/admin/transactions" },
      { icon: <ArrowDownToLine className="w-4 h-4" />, label: "Withdrawals", href: "/admin/withdrawals" },
    ],
  },
];

// Get sidebar sections based on role
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
