import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { resolvePostAuthRoute } from "@/lib/authRouting";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<"client" | "coach" | "admin">;
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, authStatus, refreshUser } = useAuth();
  const location = useLocation();
  const intendedPath = location.pathname + location.search;

  if (authStatus === "bootstrapping") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div
            className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"
            role="status"
            aria-label="Loading authentication"
          ></div>
          <p className="mt-4 text-muted-foreground">Verifying your access...</p>
        </div>
      </div>
    );
  }

  if (authStatus === "unauthenticated" || !user) {
    return <Navigate to="/auth" replace state={{ from: intendedPath }} />;
  }

  if (authStatus === "error") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <div className="w-full max-w-md rounded-lg border border-destructive/40 bg-card p-6 text-card-foreground shadow-sm">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <h1 className="text-xl font-semibold">Authentication error</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            We couldn&apos;t verify your session because of an unexpected error.
          </p>
          <div className="mt-5 flex gap-3">
            <Button onClick={() => void refreshUser()} variant="outline">
              Retry session sync
            </Button>
            <Button asChild>
              <a href="/auth" aria-label="Go to sign in">
                Go to sign in
              </a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to={resolvePostAuthRoute(role)} replace />;
  }

  return <>{children}</>;
}
