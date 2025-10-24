import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<"client" | "coach" | "admin">;
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If user is authenticated but role is still null/undefined after loading, redirect to home
  if (user && role == null && !loading) {
    logger.warn("User authenticated but no role found");
    return <Navigate to="/" replace />;
  }

  // Check role-based access
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to={`/${role}`} replace />;
  }

  return <>{children}</>;
}
