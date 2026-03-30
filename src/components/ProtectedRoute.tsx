import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<"client" | "coach" | "admin">;
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const location = useLocation();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [loading]);

  // Loading state
  if (loading) {
    if (timedOut) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
          <div className="text-center max-w-md space-y-4">
            <h2 className="text-xl font-semibold">Taking Longer Than Expected</h2>
            <p className="text-muted-foreground">
              Authentication is taking longer than usual.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => window.location.reload()}>Reload Page</Button>
              <Button variant="outline" onClick={() => window.location.href = '/auth'}>Go to Login</Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div
            className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"
            role="status"
            aria-label="Loading"
          />
          <p className="mt-4 text-muted-foreground">Verifying your access...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname + location.search }} />;
  }

  // No role found
  if (!role) {
    return <Navigate to="/auth" replace state={{ from: location.pathname + location.search }} />;
  }

  // Wrong role
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={`/${role}`} replace />;
  }

  return <>{children}</>;
}
