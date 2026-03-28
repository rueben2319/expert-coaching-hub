import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft } from "lucide-react";
import expertsLogo from "@/assets/experts-logo.png";
import { cn } from "@/lib/utils";
import { DashboardNavItem, DashboardNavSection } from "./types";
import { ProfileMenu, ProfileMenuButton } from "./ProfileMenu";
import { User } from "@supabase/supabase-js";

interface SidebarNavProps {
  collapsed?: boolean;
  brandName: string;
  sections: DashboardNavSection[];
  onItemClick: (item: DashboardNavItem) => void;
  isCurrentPath: (href: string) => boolean;
  user: User | null;
  role: "coach" | "client" | "admin" | null;
  balance: number | null;
  walletLoading: boolean;
  signOutDialogOpen: boolean;
  onSignOutDialogChange: (open: boolean) => void;
  onSignOut: () => void | Promise<void>;
  onCollapse: () => void;
  showCollapseButton?: boolean;
}

export const SidebarNav = memo(function SidebarNav({
  collapsed = false,
  brandName,
  sections,
  onItemClick,
  isCurrentPath,
  user,
  role,
  balance,
  walletLoading,
  signOutDialogOpen,
  onSignOutDialogChange,
  onSignOut,
  onCollapse,
  showCollapseButton = true,
}: SidebarNavProps) {
  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-background to-muted/20">
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

      <div className="flex-1 overflow-y-auto py-4 px-2">
        {sections.map((section, sectionIdx) => (
          <div key={sectionIdx} className="mb-6">
            {section.title && !collapsed && (
              <h3 className="px-3 text-xs font-bold text-muted-foreground mb-3 uppercase tracking-widest opacity-70">{section.title}</h3>
            )}
            <div className="space-y-1">
              {section.items.map((item, itemIdx) => {
                const isActive = item.href && isCurrentPath(item.href);
                const itemButton = (
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
                    onClick={() => onItemClick(item)}
                  >
                    <span className={cn("flex items-center flex-shrink-0", collapsed ? "" : "mr-3")}>{item.icon}</span>
                    {!collapsed && <span className="flex-1 text-left text-sm font-medium">{item.label}</span>}
                    {!collapsed && isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary ml-2 flex-shrink-0" />}
                  </Button>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={itemIdx} delayDuration={0}>
                      <TooltipTrigger asChild>{itemButton}</TooltipTrigger>
                      <TooltipContent side="right" className="font-medium">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return itemButton;
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t bg-gradient-to-t from-muted/30 to-transparent p-3 space-y-2">
        <ProfileMenu
          trigger={<ProfileMenuButton collapsed={collapsed} user={user} />}
          side={collapsed ? "right" : "top"}
          user={user}
          role={role}
          balance={balance}
          walletLoading={walletLoading}
          signOutDialogOpen={signOutDialogOpen}
          onSignOutDialogChange={onSignOutDialogChange}
          onSignOut={onSignOut}
        />

        {!collapsed && showCollapseButton && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start mt-1 hidden md:flex hover:bg-accent rounded-lg mx-2 mb-2"
            onClick={onCollapse}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            <span className="text-xs font-medium">Collapse</span>
          </Button>
        )}
      </div>
    </div>
  );
});
