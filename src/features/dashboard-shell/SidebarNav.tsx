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
  const isAdmin = role === "admin";
  const sidebarBgClass = isAdmin 
    ? "bg-muted/40 border-r border-border" 
    : "bg-gradient-to-b from-background to-muted/20";
  
  return (
    <div className={cn("flex flex-col h-full", sidebarBgClass)}>
      {!collapsed && (
        <div className={cn(
          "md:hidden p-4 border-b",
          isAdmin 
            ? "bg-muted/60 border-border" 
            : "bg-gradient-to-r from-primary/5 to-accent/5"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg overflow-hidden ring-2 flex items-center justify-center",
              isAdmin 
                ? "ring-border bg-muted" 
                : "ring-primary/20 bg-gradient-to-br from-primary to-accent"
            )}>
              <img src={expertsLogo} alt="Experts Coaching Hub" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <span className={cn("font-bold text-lg", isAdmin ? "text-foreground" : "text-foreground")}>{brandName}</span>
              <p className={cn("text-xs", isAdmin ? "text-muted-foreground" : "text-muted-foreground")}>
                {isAdmin ? "Admin Panel" : "Professional Coaching"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={cn("flex-1 overflow-y-auto", isAdmin ? "py-3 px-2" : "py-4 px-2")}>
        {sections.map((section, sectionIdx) => (
          <div key={sectionIdx} className={cn("mb-4", isAdmin && "mb-5")}>
            {section.title && !collapsed && (
              <h3 className={cn(
                "px-3 text-xs font-bold mb-2 uppercase tracking-widest text-muted-foreground",
                isAdmin 
                  ? "opacity-60" 
                  : "opacity-70"
              )}>
                {section.title}
              </h3>
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
                      collapsed ? "justify-center px-2 h-10" : cn(
                        "justify-start px-3",
                        isAdmin ? "h-9 text-sm" : "h-10 text-sm"
                      ),
                      isActive
                        ? isAdmin
                          ? "bg-primary/10 text-primary font-semibold shadow-sm border border-primary/20 hover:bg-primary/15"
                          : "bg-primary/15 text-primary font-semibold shadow-sm border border-primary/20 hover:bg-primary/20"
                        : isAdmin
                          ? "text-foreground hover:bg-primary/8 hover:text-primary"
                          : "text-foreground hover:bg-accent/50 hover:text-accent-foreground"
                    )}
                    onClick={() => onItemClick(item)}
                  >
                    <span className={cn("flex items-center flex-shrink-0", collapsed ? "" : "mr-3")}>{item.icon}</span>
                    {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
                    {!collapsed && isActive && (
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full ml-2 flex-shrink-0",
                        isAdmin ? "bg-foreground" : "bg-primary"
                      )} />
                    )}
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

      <div className={cn(
        "border-t p-3 space-y-2",
        isAdmin 
          ? "bg-muted/30 border-border" 
          : "bg-gradient-to-t from-muted/30 to-transparent"
      )}>
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
            className={cn(
              "w-full justify-start mt-1 hidden md:flex rounded-lg hover:bg-accent mx-2 mb-2"
            )}
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
