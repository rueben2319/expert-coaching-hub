import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<"client" | "coach" | "admin">;
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const location = useLocation();
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [roleCheckDelay, setRoleCheckDelay] = useState(true);

  // Set timeout for loading state
  useEffect(() => {
    if (!loading) {
      setLoadingTimeout(false);
      return;
    }

    const timer = setTimeout(() => {
      if (loading) {
        setLoadingTimeout(true);
        logger.info('Authentication loading timeout reached');
      }
    }, 15000); // 15 second timeout

    return () => clearTimeout(timer);
  }, [loading]);

  // Add a small delay before checking role to allow fetch to complete
  useEffect(() => {
    if (!user) {
      setRoleCheckDelay(false);
      return;
    }

    // If role is already present, no need to delay
    if (role) {
      setRoleCheckDelay(false);
      return;
    }

    // Start with delay enabled
    setRoleCheckDelay(true);

    // Wait up to 12 seconds for role to be fetched before deciding to redirect
    // This accounts for potential auth listener retries
    const timer = setTimeout(() => {
      setRoleCheckDelay(false);
    }, 12000);

    return () => clearTimeout(timer);
  }, [user, role]);

  // Show loading state while checking authentication or waiting for role
  if (loading || (user && roleCheckDelay)) {
    // Show timeout message if loading takes too long
    if (loadingTimeout) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
          <div className="text-center max-w-md space-y-4">
            <h2 className="text-xl font-semibold">Taking Longer Than Expected</h2>
            <p className="text-muted-foreground">
              Authentication is taking longer than usual. This might be due to a slow connection.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => window.location.reload()}>
                Reload Page
              </Button>
              <Button variant="outline" onClick={() => window.location.href = '/auth'}>
                Go to Login
              </Button>
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
            aria-label="Loading authentication"
          ></div>
          <p className="mt-4 text-muted-foreground">Verifying your access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname + location.search }} />;
  }

  // If user exists but has no role after delay, redirect to auth page to set role
  if (!role && !roleCheckDelay) {
    logger.warn('User authenticated but no role found after delay, redirecting to auth');
    return <Navigate to="/auth" replace state={{ from: location.pathname + location.search }} />;
  }

  // If still waiting for role, show loading
  if (!role) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div 
            className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"
            role="status"
            aria-label="Loading role"
          ></div>
          <p className="mt-4 text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // Check role-based access
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={`/${role}`} replace />;
  }

  return <>{children}</>;
}
