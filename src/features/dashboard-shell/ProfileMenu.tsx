import { memo, ReactNode } from "react";
import { User } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TokenManagementDashboard } from "@/components/TokenManagementDashboard";
import { BarChart3, LayoutDashboard, LogOut, Settings, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileMenuProps {
  trigger: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  user: User | null;
  role: "coach" | "client" | "admin" | null;
  balance: number | null;
  walletLoading: boolean;
  signOutDialogOpen: boolean;
  onSignOutDialogChange: (open: boolean) => void;
  onSignOut: () => void | Promise<void>;
  showTokenManagement?: boolean;
  className?: string;
}

const TokenManagementDialog = memo(function TokenManagementDialog({ children }: { children: ReactNode }) {
  return (
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
});

export const ProfileMenu = memo(function ProfileMenu({
  trigger,
  align = "end",
  side = "bottom",
  user,
  role,
  balance,
  walletLoading,
  signOutDialogOpen,
  onSignOutDialogChange,
  onSignOut,
  showTokenManagement = false,
  className,
}: ProfileMenuProps) {
  const navigate = useNavigate();

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side} className={cn("w-80 p-0 shadow-lg", className)}>
        <div className="bg-gradient-to-r from-primary/5 to-accent/5 px-4 pt-4 pb-4 flex items-start gap-3 border-b">
          <Avatar className="h-14 w-14 ring-2 ring-primary/20">
            <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.user_metadata?.full_name} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-semibold">
              {getInitials(user?.user_metadata?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 pt-1">
            <p className="text-sm font-bold leading-tight truncate text-foreground">{user?.user_metadata?.full_name || "User"}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{user?.email}</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary" className="text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20">
                {role ? role.charAt(0).toUpperCase() + role.slice(1) : "Member"}
              </Badge>
              {user?.created_at && <span className="text-xs text-muted-foreground">Since {new Date(user.created_at).getFullYear()}</span>}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 bg-muted/30 border-b">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground mb-1">Available Credits</p>
              <p className="text-lg font-bold text-foreground">{walletLoading ? "..." : `${balance ?? 0}`}</p>
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
          {showTokenManagement && (
            <TokenManagementDialog>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="px-3 py-2 mx-1 rounded-md cursor-pointer hover:bg-accent transition-colors">
                <Shield className="mr-3 h-4 w-4 text-primary" />
                <span className="font-medium">Token Management</span>
              </DropdownMenuItem>
            </TokenManagementDialog>
          )}
        </div>

        <DropdownMenuSeparator className="my-1" />

        <div className="py-2">
          <DropdownMenuItem onClick={() => navigate("/privacy")} className="px-3 py-2 mx-1 rounded-md cursor-pointer hover:bg-accent transition-colors text-sm">
            Privacy Policy
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/terms")} className="px-3 py-2 mx-1 rounded-md cursor-pointer hover:bg-accent transition-colors text-sm">
            Terms of Service
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator className="my-1" />

        <div className="py-2">
          <AlertDialog open={signOutDialogOpen} onOpenChange={onSignOutDialogChange}>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  onSignOutDialogChange(true);
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
                <AlertDialogAction onClick={onSignOut} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Sign out
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

export const ProfileMenuButton = memo(function ProfileMenuButton({
  collapsed,
  user,
}: {
  collapsed?: boolean;
  user: User | null;
}) {
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
          <span className="text-sm font-semibold truncate w-full text-foreground">{user?.user_metadata?.full_name || "User"}</span>
          <span className="text-xs text-muted-foreground truncate w-full">{user?.email}</span>
        </div>
      )}
    </Button>
  );
});
