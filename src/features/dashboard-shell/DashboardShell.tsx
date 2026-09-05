import { memo, ReactNode, useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DashboardNavItem, DashboardNavSection } from "./types";
import { TopBar } from "./TopBar";
import { SidebarNav } from "./SidebarNav";
import { MobileSearchDrawer } from "./MobileSearchDrawer";
import { useGlobalDashboardSearch } from "./hooks/useGlobalDashboardSearch";

export interface DashboardShellProps {
  children: ReactNode;
  sidebarSections?: DashboardNavSection[];
  brandName?: string;
}

const DesktopSidebar = memo(function DesktopSidebar({
  sidebarCollapsed,
  onToggleCollapse,
  ...props
}: {
  sidebarCollapsed: boolean;
  onToggleCollapse: () => void;
  brandName: string;
  sections: DashboardNavSection[];
  onItemClick: (item: DashboardNavItem) => void;
  isCurrentPath: (href: string) => boolean;
  user: ReturnType<typeof useAuth>["user"];
  role: ReturnType<typeof useAuth>["role"];
  balance: number | null;
  walletLoading: boolean;
  signOutDialogOpen: boolean;
  onSignOutDialogChange: (open: boolean) => void;
  onSignOut: () => void | Promise<void>;
}) {
  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r bg-card/50 transition-all duration-300 overflow-hidden",
        sidebarCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex items-center justify-end p-2 border-b flex-shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent" onClick={onToggleCollapse}>
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
      <SidebarNav collapsed={sidebarCollapsed} onCollapse={onToggleCollapse} {...props} />
    </aside>
  );
});

export const DashboardShell = memo(function DashboardShell({
  children,
  sidebarSections = [],
  brandName = "Experts Coaching Hub",
}: DashboardShellProps) {
  const { user, signOut, role } = useAuth();
  const { balance, walletLoading } = useCredits();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const { desktopPlaceholder, mobilePlaceholder, submitSearch } = useGlobalDashboardSearch(role);

  const onCloseSearch = useCallback(() => setSearchOpen(false), []);
  const onToggleSearch = useCallback(() => setSearchOpen((open) => !open), []);
  const onToggleSidebarCollapsed = useCallback(() => setSidebarCollapsed((collapsed) => !collapsed), []);
  const onSearchQueryChange = useCallback((query: string) => setSearchQuery(query), []);
  const onSearchSubmit = useCallback(() => submitSearch(searchQuery), [searchQuery, submitSearch]);

  const isCurrentPath = useCallback(
    (href: string) => location.pathname === href,
    [location.pathname]
  );

  const onSidebarItemClick = useCallback(
    (item: DashboardNavItem) => {
      if (item.onClick) {
        item.onClick();
      } else if (item.href) {
        navigate(item.href);
      }
      setSidebarOpen(false);
    },
    [navigate]
  );

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
        if (searchOpen) onCloseSearch();
        if (sidebarOpen) setSidebarOpen(false);
      },
      description: "Close modals/dialogs",
    },
  ]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to main content
      </a>

      <TopBar
        brandName={brandName}
        sections={sidebarSections}
        sidebarOpen={sidebarOpen}
        onSidebarOpenChange={setSidebarOpen}
        searchOpen={searchOpen}
        onSearchOpenToggle={onToggleSearch}
        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
        onSearchSubmit={onSearchSubmit}
        desktopSearchPlaceholder={desktopPlaceholder}
        user={user}
        role={role}
        balance={balance}
        walletLoading={walletLoading}
        signOutDialogOpen={signOutDialogOpen}
        onSignOutDialogChange={setSignOutDialogOpen}
        onSignOut={signOut}
        onSidebarItemClick={onSidebarItemClick}
        isCurrentPath={isCurrentPath}
      />

      <MobileSearchDrawer
        open={searchOpen}
        query={searchQuery}
        placeholder={mobilePlaceholder}
        onChangeQuery={onSearchQueryChange}
        onClose={onCloseSearch}
        onSubmit={onSearchSubmit}
      />

      <div className="flex flex-1 overflow-hidden">
        {sidebarSections.length > 0 && (
          <DesktopSidebar
            sidebarCollapsed={sidebarCollapsed}
            onToggleCollapse={onToggleSidebarCollapsed}
            brandName={brandName}
            sections={sidebarSections}
            onItemClick={onSidebarItemClick}
            isCurrentPath={isCurrentPath}
            user={user}
            role={role}
            balance={balance}
            walletLoading={walletLoading}
            signOutDialogOpen={signOutDialogOpen}
            onSignOutDialogChange={setSignOutDialogOpen}
            onSignOut={signOut}
          />
        )}

        <main id="main-content" className="flex-1 overflow-y-auto" tabIndex={-1}>
          <div className="container mx-auto p-6">{children}</div>
        </main>
      </div>
    </div>
  );
});
