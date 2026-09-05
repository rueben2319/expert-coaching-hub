import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { resolvePostAuthRoute } from "@/lib/authRouting";
import { Loader2, ShieldAlert } from "lucide-react";

export default function AuthCallback() {
  const { status, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "authenticated" && role) {
      navigate(resolvePostAuthRoute(role), { replace: true });
    } else if (status === "unauthenticated" || status === "error") {
      navigate("/auth?error=oauth_failed", { replace: true });
    }
    // "bootstrapping" → keep showing spinner
  }, [status, role, navigate]);

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-destructive">
          <ShieldAlert className="h-5 w-5" />
          <p>Sign-in failed. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/10">
      <div className="w-16 h-16 rounded-2xl bg-background/80 shadow-lg flex items-center justify-center backdrop-blur-md border border-white/10 mb-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
      <h2 className="text-xl font-medium tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
        Authenticating...
      </h2>
      <p className="text-sm text-muted-foreground mt-2">Please wait while we verify your session.</p>
    </div>
  );
}
