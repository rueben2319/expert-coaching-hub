import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

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

  // If allowedRoles is specified, we need to wait for the role to load
  // and then check if the user has the required role
  if (allowedRoles) {
    // If role hasn't loaded yet, show loading (prevents unauthorized access)
    if (role === null) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
            <p className="mt-4 text-muted-foreground">Verifying permissions...</p>
          </div>
        </div>
      );
    }
    
    // If role is loaded but not in allowedRoles, redirect to their role-specific page
    if (!allowedRoles.includes(role)) {
      return <Navigate to={`/${role}`} replace />;
    }
  }

  return <>{children}</>;
}
