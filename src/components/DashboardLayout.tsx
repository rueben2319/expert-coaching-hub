import { ReactNode, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LogOut,
  Menu,
  User,
  Search,
  HelpCircle,
  Globe,
  Shield,
  LayoutDashboard,
  BarChart3,
  Settings,
  X,
} from "lucide-react";
import expertsLogo from "@/assets/experts-logo.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TokenManagementDashboard } from "@/components/TokenManagementDashboard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCredits } from "@/hooks/useCredits";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
interface SidebarItem {
  icon: ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
}

interface SidebarSection {
  title?: string;
  items: SidebarItem[];
}

interface DashboardLayoutProps {
  children: ReactNode;
  sidebarSections?: SidebarSection[];
  brandName?: string;
}

const TokenManagementDialog = ({ children }: { children: ReactNode }) => (
  <Dialog>
    <DialogTrigger asChild>{children}</DialogTrigger>
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>OAuth Token Management</DialogTitle>
      </DialogHeader>
      <TokenManagementDashboard />
    </DialogContent>
  </Dialog>
);

export function DashboardLayout({
  children,
  sidebarSections = [],
  brandName = "Experts Coaching Hub",
}: DashboardLayoutProps) {
  const { user, signOut, role } = useAuth();
  const { balance, walletLoading } = useCredits();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "/",
      action: () => {
        const searchInput = document.querySelector('input[type="text"][placeholder*="Search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      },
      description: "Focus search",
    },
    {
      key: "Escape",
      action: () => {
        if (searchOpen) {
          setSearchOpen(false);
        }
        if (sidebarOpen) {
          setSidebarOpen(false);
        }
      },
      description: "Close modals/dialogs",
    },
  ]);

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isCurrentPath = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + "/");
  };

  const handleSidebarItemClick = (item: SidebarItem) => {
    if (item.onClick) {
      item.onClick();
    } else if (item.href) {
      navigate(item.href);
    }
    setSidebarOpen(false);
  };

  const renderSidebarContent = (collapsed: boolean = false) => (
    <div className="flex flex-col h-full bg-gradient-to-b from-background to-muted/20">
      {/* Sidebar Header - Mobile Only */}
      {!collapsed && (
        <div className="md:hidden p-6 border-b bg-gradient-to-r from-primary/5 to-accent/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden ring-2 ring-primary/20 bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <img src={expertsLogo} alt="Experts Coaching Hub" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <span className="font-bold text-lg text-foreground">{brandName}</span>
              <p className="text-xs text-muted-foreground">Professional Coaching</p>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Items */}
      <div className="flex-1 overflow-y-auto py-4 px-2">
        {sidebarSections.map((section, sectionIdx) => (
          <div key={sectionIdx} className="mb-6">
            {section.title && !collapsed && (
              <h3 className="px-3 text-xs font-bold text-muted-foreground mb-3 uppercase tracking-widest opacity-70">
                {section.title}
              </h3>
            )}
            <div className="space-y-1">
              {section.items.map((item, itemIdx) => {
                const isActive = item.href && isCurrentPath(item.href);
                const ItemButton = (
                  <Button
                    key={itemIdx}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "w-full transition-all duration-200 rounded-lg",
                      collapsed ? "justify-center px-2 h-10" : "justify-start h-10 px-3",
                      isActive
                        ? "bg-primary/15 text-primary font-semibold shadow-sm border border-primary/20 hover:bg-primary/20"
                        : "text-foreground hover:bg-accent/50 hover:text-accent-foreground"
                    )}
                    onClick={() => handleSidebarItemClick(item)}
                  >
                    <span className={cn("flex items-center flex-shrink-0", collapsed ? "" : "mr-3")}>
                      {item.icon}
                    </span>
                    {!collapsed && <span className="flex-1 text-left text-sm font-medium">{item.label}</span>}
                    {!collapsed && isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary ml-2 flex-shrink-0" />
                    )}
                  </Button>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={itemIdx} delayDuration={0}>
                      <TooltipTrigger asChild>{ItemButton}</TooltipTrigger>
                      <TooltipContent side="right" className="font-medium">{item.label}</TooltipContent>
                    </Tooltip>
                  );
                }

                return ItemButton;
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User Section - Bottom */}
      <div className="border-t bg-gradient-to-t from-muted/30 to-transparent p-3 space-y-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full transition-all duration-200 rounded-lg hover:bg-accent/50",
                collapsed ? "justify-center px-2 h-10" : "justify-start h-auto py-2.5 px-3 hover:bg-primary/5"
              )}
            >
              <Avatar className={cn("h-9 w-9 ring-2 ring-primary/20", !collapsed && "mr-3")}>
                <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.user_metadata?.full_name} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-semibold">
                  {getInitials(user?.user_metadata?.full_name)}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex flex-col items-start flex-1 min-w-0">
                  <span className="text-sm font-semibold truncate w-full text-foreground">
                    {user?.user_metadata?.full_name || "User"}
                  </span>
                  <span className="text-xs text-muted-foreground truncate w-full">
                    {user?.email}
                  </span>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side={collapsed ? "right" : "top"}
            className="w-80 p-0 shadow-lg"
          >
            {/* Profile Header Section */}
            <div className="bg-gradient-to-r from-primary/5 to-accent/5 px-4 pt-4 pb-4 flex items-start gap-3 border-b">
              <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.user_metadata?.full_name} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-semibold">
                  {getInitials(user?.user_metadata?.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 pt-1">
                <p className="text-sm font-bold leading-tight truncate text-foreground">
                  {user?.user_metadata?.full_name || "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {user?.email}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge 
                    variant="secondary" 
                    className="text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    {role ? role.charAt(0).toUpperCase() + role.slice(1) : "Member"}
                  </Badge>
                  {user?.created_at && (
                    <span className="text-xs text-muted-foreground">
                      Since {new Date(user.created_at).getFullYear()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Credits Section */}
            <div className="px-4 py-3 bg-muted/30 border-b">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Available Credits</p>
                  <p className="text-lg font-bold text-foreground">
                    {walletLoading ? "..." : `${balance ?? 0}`}
                  </p>
                </div>
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  onClick={() => navigate("/profile?tab=credits")}
                >
                  Buy
                </button>
              </div>
            </div>

            {/* Main Menu Items */}
            <div className="py-2">
              <DropdownMenuItem 
                onClick={() => navigate(role === "coach" ? "/coach" : role === "admin" ? "/admin" : "/client")}
                className="px-3 py-2 mx-1 rounded-md cursor-pointer hover:bg-accent transition-colors"
              >
                <LayoutDashboard className="mr-3 h-4 w-4 text-primary" />
                <span className="font-medium">Dashboard</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => navigate(role === "coach" ? "/coach/analytics" : "/client/analytics")}
                className="px-3 py-2 mx-1 rounded-md cursor-pointer hover:bg-accent transition-colors"
              >
                <BarChart3 className="mr-3 h-4 w-4 text-primary" />
                <span className="font-medium">Progress</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => navigate("/profile")}
                className="px-3 py-2 mx-1 rounded-md cursor-pointer hover:bg-accent transition-colors"
              >
                <Settings className="mr-3 h-4 w-4 text-primary" />
                <span className="font-medium">Settings</span>
              </DropdownMenuItem>
            </div>

            <DropdownMenuSeparator className="my-1" />

            {/* Secondary Menu Items */}
            <div className="py-2">
              <DropdownMenuItem 
                onClick={() => navigate("/privacy")}
                className="px-3 py-2 mx-1 rounded-md cursor-pointer hover:bg-accent transition-colors text-sm"
              >
                Privacy Policy
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => navigate("/terms")}
                className="px-3 py-2 mx-1 rounded-md cursor-pointer hover:bg-accent transition-colors text-sm"
              >
                Terms of Service
              </DropdownMenuItem>
            </div>

            <DropdownMenuSeparator className="my-1" />

            {/* Sign Out */}
            <div className="py-2">
              <AlertDialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen}>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem 
                    onSelect={(e) => {
                      e.preventDefault();
                      setSignOutDialogOpen(true);
                    }}
                    className="px-3 py-2 mx-1 rounded-md cursor-pointer hover:bg-destructive/10 text-destructive hover:text-destructive transition-colors font-medium"
                  >
                    <LogOut className="mr-3 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sign out?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to sign out? You'll need to sign in again to access your account.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={signOut}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Sign out
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Collapse Toggle - Desktop Only */}
        {!collapsed && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start mt-1 hidden md:flex hover:bg-accent rounded-lg mx-2 mb-2"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            <span className="text-xs font-medium">Collapse</span>
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Skip Navigation Link - WCAG 2.1 Level A Requirement */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to main content
      </a>
      {/* Navbar */}
      <header className="flex-shrink-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center px-4 md:px-6">
          {/* Mobile Menu Toggle */}
          {sidebarSections.length > 0 && (
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-11 w-11 md:h-9 md:w-9 md:hidden mr-2"
                  aria-label="Open navigation menu"
                  aria-expanded={sidebarOpen}
                  aria-controls="mobile-sidebar"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                {renderSidebarContent(false)}
              </SheetContent>
            </Sheet>
          )}

          {/* Logo/Brand */}
          <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg overflow-hidden flex-shrink-0">
              <img 
                src={expertsLogo} 
                alt="Experts Coaching Hub logo - Return to homepage" 
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-semibold text-sm sm:text-base md:text-lg hidden sm:inline truncate max-w-[120px] md:max-w-[180px] lg:max-w-none">
              {brandName}
            </span>
          </div>

          {/* Search Bar - Responsive */}
          <div className="flex-1 max-w-xl mx-2 md:mx-4 hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={
                  role === 'coach' 
                    ? "Search courses, students, sessions..."
                    : role === 'client'
                    ? "Search courses, lessons, coaches..."
                    : role === 'admin'
                    ? "Search users, transactions, courses..."
                    : "Search..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 h-9 w-full"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    // Handle search based on role
                    if (role === 'coach') {
                      navigate(`/coach/courses?search=${encodeURIComponent(searchQuery)}`);
                    } else if (role === 'client') {
                      navigate(`/client/courses?search=${encodeURIComponent(searchQuery)}`);
                    } else if (role === 'admin') {
                      navigate(`/admin/users?search=${encodeURIComponent(searchQuery)}`);
                    }
                  }
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
            {/* Help Button - Hidden on mobile */}
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-11 w-11 md:h-9 md:w-9 hidden md:flex"
                  aria-label="Get help"
                >
                  <HelpCircle className="h-4 w-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Help & Support</TooltipContent>
            </Tooltip>

            {/* Language/Globe Button - Hidden on mobile */}
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-11 w-11 md:h-9 md:w-9 hidden md:flex"
                  aria-label="Change language"
                >
                  <Globe className="h-4 w-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Language</TooltipContent>
            </Tooltip>

            {/* Search Icon for Mobile - Opens search on small screens */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-11 w-11 sm:h-9 sm:w-9 sm:hidden"
              onClick={() => setSearchOpen(!searchOpen)}
              aria-label="Open search"
              aria-expanded={searchOpen}
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </Button>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="h-11 w-11 md:h-9 md:w-9 rounded-full p-0"
                  aria-label={`User menu for ${user?.user_metadata?.full_name || 'user'}`}
                  aria-haspopup="true"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.user_metadata?.full_name} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs">
                      {getInitials(user?.user_metadata?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0 shadow-lg">
                {/* Profile Header Section */}
                <div className="bg-gradient-to-r from-primary/5 to-accent/5 px-4 pt-4 pb-4 flex items-start gap-3 border-b">
                  <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                    <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.user_metadata?.full_name} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-semibold">
                      {getInitials(user?.user_metadata?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="text-sm font-bold leading-tight truncate text-foreground">
                      {user?.user_metadata?.full_name || "User"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {user?.email}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge 
                        variant="secondary" 
                        className="text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20"
                      >
                        {role ? role.charAt(0).toUpperCase() + role.slice(1) : "Member"}
                      </Badge>
                      {user?.created_at && (
                        <span className="text-xs text-muted-foreground">
                          Since {new Date(user.created_at).getFullYear()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Credits Section */}
                <div className="px-4 py-3 bg-muted/30 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Available Credits</p>
                      <p className="text-lg font-bold text-foreground">
                        {walletLoading ? "..." : `${balance ?? 0}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                      onClick={() => navigate("/profile?tab=credits")}
                    >
                      Buy
                    </button>
                  </div>
                </div>

                {/* Main Menu Items */}
                <div className="py-2">
                  <DropdownMenuItem 
                    onClick={() => navigate(role === "coach" ? "/coach" : role === "admin" ? "/admin" : "/client")}
                    className="px-3 py-2 mx-1 rounded-md cursor-pointer hover:bg-accent transition-colors"
                  >
                    <LayoutDashboard className="mr-3 h-4 w-4 text-primary" />
                    <span className="font-medium">Dashboard</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => navigate(role === "coach" ? "/coach/analytics" : "/client/analytics")}
                    className="px-3 py-2 mx-1 rounded-md cursor-pointer hover:bg-accent transition-colors"
                  >
                    <BarChart3 className="mr-3 h-4 w-4 text-primary" />
                    <span className="font-medium">Progress</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => navigate("/profile")}
                    className="px-3 py-2 mx-1 rounded-md cursor-pointer hover:bg-accent transition-colors"
                  >
                    <Settings className="mr-3 h-4 w-4 text-primary" />
                    <span className="font-medium">Settings</span>
                  </DropdownMenuItem>
                  <TokenManagementDialog>
                    <DropdownMenuItem 
                      onSelect={(e) => e.preventDefault()}
                      className="px-3 py-2 mx-1 rounded-md cursor-pointer hover:bg-accent transition-colors"
                    >
                      <Shield className="mr-3 h-4 w-4 text-primary" />
                      <span className="font-medium">Token Management</span>
                    </DropdownMenuItem>
                  </TokenManagementDialog>
                </div>

                <DropdownMenuSeparator className="my-1" />

                {/* Secondary Menu Items */}
                <div className="py-2">
                  <DropdownMenuItem 
                    onClick={() => navigate("/privacy")}
                    className="px-3 py-2 mx-1 rounded-md cursor-pointer hover:bg-accent transition-colors text-sm"
                  >
                    Privacy Policy
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => navigate("/terms")}
                    className="px-3 py-2 mx-1 rounded-md cursor-pointer hover:bg-accent transition-colors text-sm"
                  >
                    Terms of Service
                  </DropdownMenuItem>
                </div>

                <DropdownMenuSeparator className="my-1" />

                {/* Sign Out */}
                <div className="py-2">
                  <AlertDialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem 
                        onSelect={(e) => {
                          e.preventDefault();
                          setSignOutDialogOpen(true);
                        }}
                        className="px-3 py-2 mx-1 rounded-md cursor-pointer hover:bg-destructive/10 text-destructive hover:text-destructive transition-colors font-medium"
                      >
                        <LogOut className="mr-3 h-4 w-4" />
                        Sign out
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Sign out?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to sign out? You'll need to sign in again to access your account.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={signOut}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Sign out
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile Search Bar - Shows below header on small screens when search is open */}
        {searchOpen && (
          <div className="sm:hidden border-t px-4 py-3 bg-background">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={
                  role === 'coach' 
                    ? "Search courses, students..."
                    : role === 'client'
                    ? "Search courses..."
                    : role === 'admin'
                    ? "Search users..."
                    : "Search..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 h-10 w-full"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    setSearchOpen(false);
                    // Handle search based on role
                    if (role === 'coach') {
                      navigate(`/coach/courses?search=${encodeURIComponent(searchQuery)}`);
                    } else if (role === 'client') {
                      navigate(`/client/courses?search=${encodeURIComponent(searchQuery)}`);
                    } else if (role === 'admin') {
                      navigate(`/admin/users?search=${encodeURIComponent(searchQuery)}`);
                    }
                  } else if (e.key === 'Escape') {
                    setSearchOpen(false);
                  }
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        {sidebarSections.length > 0 && (
          <aside
            className={cn(
              "hidden md:flex flex-col border-r bg-card/50 transition-all duration-300 overflow-hidden",
              sidebarCollapsed ? "w-16" : "w-64"
            )}
          >
            {/* Collapse Toggle Button - Top */}
            <div className="flex items-center justify-end p-2 border-b flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-accent"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </div>
            {renderSidebarContent(sidebarCollapsed)}
          </aside>
        )}

        {/* Main Content */}
        <main id="main-content" className="flex-1 overflow-y-auto" tabIndex={-1}>
          <div className="container mx-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
