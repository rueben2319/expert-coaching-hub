import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import expertsLogo from "@/assets/experts-logo.png";

const GENERIC_RESET_MESSAGE = "If this recovery link is valid, your password has been updated.";

const passwordStrength = (pwd: string) => {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8) score += 40;
  if (/[A-Z]/.test(pwd)) score += 15;
  if (/\d/.test(pwd)) score += 20;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 25;
  return Math.min(100, score);
};

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasRecoveryContext, setHasRecoveryContext] = useState(false);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordsMatch = useMemo(() => password.length > 0 && password === confirmPassword, [password, confirmPassword]);
  const canSubmit = password.length >= 8 && passwordStrength(password) >= 60 && passwordsMatch && hasRecoveryContext;

  useEffect(() => {
    let isMounted = true;

    const hasRecoveryType = new URLSearchParams(window.location.hash.replace("#", "")).get("type") === "recovery";

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;

      setHasRecoveryContext(hasRecoveryType && Boolean(data.session));
      setIsLoadingContext(false);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (!isMounted) return;
      if (event === "PASSWORD_RECOVERY") {
        setHasRecoveryContext(true);
      }
    });

    void checkSession();

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleResetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);

    try {
      await supabase.auth.updateUser({ password });
      toast.success(GENERIC_RESET_MESSAGE);
      navigate("/auth", { replace: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl overflow-hidden">
            <img src={expertsLogo} alt="Experts Coaching Hub" className="w-full h-full object-contain" />
          </div>
          <CardTitle>Create a new password</CardTitle>
          <CardDescription>
            Choose a strong new password for your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingContext ? (
            <p className="text-sm text-muted-foreground text-center">Verifying recovery link...</p>
          ) : !hasRecoveryContext ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">This reset link is invalid or has expired.</p>
              <Link to="/forgot-password" className="text-primary hover:underline text-sm">
                Request a new password reset link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">Use at least 8 characters including a number and a symbol.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={8}
                />
                {!passwordsMatch && confirmPassword.length > 0 ? (
                  <p className="text-xs text-destructive">Passwords do not match.</p>
                ) : null}
              </div>
              <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? "Updating..." : "Update password"}
              </Button>
            </form>
          )}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link to="/auth" className="text-primary hover:underline">Back to sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
