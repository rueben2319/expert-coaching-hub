import { ReactNode, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search,
  HelpCircle,
  Globe,
  Menu,
  GraduationCap,
  LogOut,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";

interface NavItem {
  label: string;
  href: string;
  current?: boolean;
}

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
  navItems: NavItem[];
  sidebarSections?: SidebarSection[];
  brandName?: string;
}

export function DashboardLayout({
  children,
  navItems,
  sidebarSections = [],
  brandName = "Insight Coach",
}: DashboardLayoutProps) {
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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
    <div className="flex flex-col h-full">
      {/* Sidebar Header - Mobile Only */}
      {!collapsed && (
        <div className="md:hidden p-6 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">{brandName}</span>
          </div>
        </div>
      )}

      {/* Sidebar Items */}
      <div className="flex-1 overflow-y-auto py-4">
        {sidebarSections.map((section, sectionIdx) => (
          <div key={sectionIdx} className="mb-6">
            {section.title && !collapsed && (
              <h3 className="px-4 text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                {section.title}
              </h3>
            )}
            <div className="space-y-1 px-2">
              {section.items.map((item, itemIdx) => {
                const isActive = item.href && isCurrentPath(item.href);
                const ItemButton = (
                  <Button
                    key={itemIdx}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "w-full transition-colors",
                      collapsed ? "justify-center px-2 h-10" : "justify-start h-9",
                      isActive
                        ? "bg-primary/10 text-primary hover:bg-primary/15"
                        : "hover:bg-accent"
                    )}
                    onClick={() => handleSidebarItemClick(item)}
                  >
                    <span className={cn("flex items-center", collapsed ? "" : "mr-3")}>
                      {item.icon}
                    </span>
                    {!collapsed && <span className="flex-1 text-left text-sm">{item.label}</span>}
                  </Button>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={itemIdx} delayDuration={0}>
                      <TooltipTrigger asChild>{ItemButton}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
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
      <div className="border-t p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full hover:bg-accent",
                collapsed ? "justify-center px-2 h-10" : "justify-start h-auto py-2"
              )}
            >
              <Avatar className={cn("h-8 w-8", !collapsed && "mr-3")}>
                <AvatarImage src="" alt={user?.user_metadata?.full_name} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs">
                  {getInitials(user?.user_metadata?.full_name)}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex flex-col items-start flex-1 min-w-0">
                  <span className="text-sm font-medium truncate w-full">
                    {user?.user_metadata?.full_name || "User"}
                  </span>
                  <span className="text-xs text-muted-foreground truncate w-full">
                    {user?.email}
                  </span>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side={collapsed ? "right" : "top"} className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {user?.user_metadata?.full_name || "User"}
                </span>
                <span className="text-xs text-muted-foreground">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/profile")}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Collapse Toggle - Desktop Only */}
        {!collapsed && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start mt-1 hidden md:flex hover:bg-accent"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            <span className="text-sm">Collapse</span>
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="flex h-16 items-center px-4 md:px-6">
          {/* Mobile Menu Toggle */}
          {sidebarSections.length > 0 && (
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden mr-2">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                {renderSidebarContent(false)}
              </SheetContent>
            </Sheet>
          )}

          {/* Logo/Brand */}
          <div className="flex items-center gap-2 mr-6">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg hidden sm:inline">{brandName}</span>
          </div>

          {/* Navigation Items - Hidden on mobile */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {navItems.map((item) => (
              <Button
                key={item.href}
                variant="ghost"
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  isCurrentPath(item.href)
                    ? "text-primary bg-primary/5"
                    : "text-muted-foreground"
                )}
                onClick={() => navigate(item.href)}
              >
                {item.label}
              </Button>
            ))}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-1 ml-auto">
            {/* Search Button */}
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Search className="h-4 w-4" />
            </Button>

            {/* Help Button */}
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <HelpCircle className="h-4 w-4" />
            </Button>

            {/* Language/Globe Button */}
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Globe className="h-4 w-4" />
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 w-9 rounded-full p-0">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="" alt={user?.user_metadata?.full_name} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs">
                      {getInitials(user?.user_metadata?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {user?.user_metadata?.full_name || "User"}
                    </span>
                    <span className="text-xs text-muted-foreground">{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden border-t px-4 py-2 flex gap-2 overflow-x-auto">
          {navItems.map((item) => (
            <Button
              key={item.href}
              variant="ghost"
              size="sm"
              className={cn(
                "text-sm whitespace-nowrap",
                isCurrentPath(item.href)
                  ? "text-primary bg-primary/5"
                  : "text-muted-foreground"
              )}
              onClick={() => navigate(item.href)}
            >
              {item.label}
            </Button>
          ))}
        </nav>
      </header>

      {/* Main Layout */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Desktop Sidebar */}
        {sidebarSections.length > 0 && (
          <aside
            className={cn(
              "hidden md:flex flex-col border-r bg-card/50 transition-all duration-300",
              sidebarCollapsed ? "w-16" : "w-64"
            )}
          >
            {/* Collapse Toggle Button - Top */}
            <div className="flex items-center justify-end p-2 border-b">
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
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
