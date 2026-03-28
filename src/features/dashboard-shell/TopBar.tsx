import { memo } from "react";
import { User } from "@supabase/supabase-js";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import expertsLogo from "@/assets/experts-logo.png";
import { HelpCircle, Globe, Menu, Search, X } from "lucide-react";
import { SidebarNav } from "./SidebarNav";
import { DashboardNavItem, DashboardNavSection } from "./types";
import { ProfileMenu } from "./ProfileMenu";

interface TopBarProps {
  brandName: string;
  sections: DashboardNavSection[];
  sidebarOpen: boolean;
  onSidebarOpenChange: (open: boolean) => void;
  searchOpen: boolean;
  onSearchOpenToggle: () => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSearchSubmit: () => void;
  desktopSearchPlaceholder: string;
  user: User | null;
  role: "coach" | "client" | "admin" | null;
  balance: number | null;
  walletLoading: boolean;
  signOutDialogOpen: boolean;
  onSignOutDialogChange: (open: boolean) => void;
  onSignOut: () => void | Promise<void>;
  onSidebarItemClick: (item: DashboardNavItem) => void;
  isCurrentPath: (href: string) => boolean;
}

export const TopBar = memo(function TopBar({
  brandName,
  sections,
  sidebarOpen,
  onSidebarOpenChange,
  searchOpen,
  onSearchOpenToggle,
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  desktopSearchPlaceholder,
  user,
  role,
  balance,
  walletLoading,
  signOutDialogOpen,
  onSignOutDialogChange,
  onSignOut,
  onSidebarItemClick,
  isCurrentPath,
}: TopBarProps) {
  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="flex-shrink-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4 md:px-6">
        {sections.length > 0 && (
          <Sheet open={sidebarOpen} onOpenChange={onSidebarOpenChange}>
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
              <SidebarNav
                brandName={brandName}
                sections={sections}
                onItemClick={onSidebarItemClick}
                isCurrentPath={isCurrentPath}
                user={user}
                role={role}
                balance={balance}
                walletLoading={walletLoading}
                signOutDialogOpen={signOutDialogOpen}
                onSignOutDialogChange={onSignOutDialogChange}
                onSignOut={onSignOut}
                onCollapse={() => undefined}
                showCollapseButton={false}
              />
            </SheetContent>
          </Sheet>
        )}

        <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg overflow-hidden flex-shrink-0">
            <img src={expertsLogo} alt="Experts Coaching Hub logo - Return to homepage" className="w-full h-full object-contain" />
          </div>
          <span className="font-semibold text-sm sm:text-base md:text-lg hidden sm:inline truncate max-w-[120px] md:max-w-[180px] lg:max-w-none">
            {brandName}
          </span>
        </div>

        <div className="flex-1 max-w-xl mx-2 md:mx-4 hidden sm:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={desktopSearchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="pl-10 pr-10 h-9 w-full"
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchQuery.trim()) {
                  onSearchSubmit();
                }
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchQueryChange("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11 md:h-9 md:w-9 hidden md:flex" aria-label="Get help">
                <HelpCircle className="h-4 w-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Help & Support</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11 md:h-9 md:w-9 hidden md:flex" aria-label="Change language">
                <Globe className="h-4 w-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Language</TooltipContent>
          </Tooltip>

          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 sm:h-9 sm:w-9 sm:hidden"
            onClick={onSearchOpenToggle}
            aria-label="Open search"
            aria-expanded={searchOpen}
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </Button>

          <ThemeToggle />

          <ProfileMenu
            trigger={
              <Button
                variant="ghost"
                className="h-11 w-11 md:h-9 md:w-9 rounded-full p-0"
                aria-label={`User menu for ${user?.user_metadata?.full_name || "user"}`}
                aria-haspopup="true"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.user_metadata?.full_name} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs">
                    {getInitials(user?.user_metadata?.full_name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            }
            user={user}
            role={role}
            balance={balance}
            walletLoading={walletLoading}
            signOutDialogOpen={signOutDialogOpen}
            onSignOutDialogChange={onSignOutDialogChange}
            onSignOut={onSignOut}
            showTokenManagement
          />
        </div>
      </div>
    </header>
  );
});
