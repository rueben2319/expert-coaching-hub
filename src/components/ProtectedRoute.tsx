import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { resolvePostAuthRoute } from "@/lib/authRouting";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<"client" | "coach" | "admin">;
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading, status } = useAuth();
  const location = useLocation();
  const intendedPath = location.pathname + location.search;

  if (loading || status === "idle" || status === "bootstrapping") {
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

  if (!user || status === "unauthenticated") {
    return <Navigate to="/auth" replace state={{ from: intendedPath }} />;
  }

  if (!role || status === "role_missing") {
    return <Navigate to="/auth" replace state={{ from: intendedPath }} />;
  }

  if (status === "error") {
    return <Navigate to="/auth" replace state={{ from: intendedPath }} />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={resolvePostAuthRoute(role)} replace />;
  }

  return <>{children}</>;
}
