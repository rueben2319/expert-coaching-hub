import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { GraduationCap, Users, BookOpen, Mail, Loader2 } from "lucide-react";
import expertsLogo from "@/assets/experts-logo.png";
import { ThemeToggle } from "@/components/ThemeToggle";

const passwordStrength = (pwd: string) => {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8) score += 40;
  if (/[A-Z]/.test(pwd)) score += 15;
  if (/\d/.test(pwd)) score += 20;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 25;
  return Math.min(100, score);
};

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<"client" | "coach">("client");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [pendingRole, setPendingRole] = useState<"client" | "coach">("client");
  const [submittingRole, setSubmittingRole] = useState(false);
  const [isFromOAuth, setIsFromOAuth] = useState(false);
  const [oauthRolePromptOpen, setOauthRolePromptOpen] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { user, role, refreshRole, signOut } = useAuth();

  useEffect(() => {
    if (!user) return;

    // If role already set, navigate immediately
    if (role) {
      navigate(`/${role}`);
      return;
    }

    (async () => {
      try {
        // Ensure we refresh the role from DB first to avoid race conditions
        await refreshRole();

        // Re-check role directly from DB to avoid stale closure values
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (roleData && roleData.role) {
          navigate(`/${roleData.role}`);
          return;
        }

        // No role found after refresh -> only show role dialog for OAuth flows (flag + provider detection)
        const oauthFlag = (() => {
          try { return localStorage.getItem('oauth_provider'); } catch (e) { return null; }
        })();

        const { data: { session } } = await supabase.auth.getSession();
        const sessionProvider = (session as any)?.provider || null;
        const hasProviderToken = Boolean((session as any)?.provider_token);

        const identityProvider = Array.isArray((user as any).identities)
          ? (user as any).identities.find((i: any) => i.provider === 'google')
          : null;

        const isOAuthUserDetected = Boolean(
          sessionProvider === 'google' ||
          identityProvider ||
          user.app_metadata?.provider === 'google' ||
          user.user_metadata?.provider === 'google' ||
          (hasProviderToken && !!identityProvider)
        );

        const shouldShowRoleDialog = oauthFlag === 'google' || isOAuthUserDetected;

        if (shouldShowRoleDialog) {
          // If we have a preselected role saved from before redirect, assign it automatically
          let desiredRole: string | null = null;
          try { desiredRole = localStorage.getItem('oauth_role'); } catch (e) { desiredRole = null; }

          if (desiredRole === 'client' || desiredRole === 'coach') {
            try {
              // upsert user role server-side
              const { error: roleError } = await supabase
                .from('user_roles')
                .upsert({ user_id: user.id, role: desiredRole }, { onConflict: 'user_id' });

              if (roleError) throw roleError;

              await supabase.auth.updateUser({ data: { role: desiredRole } });
              await refreshRole();
              try { localStorage.removeItem('oauth_provider'); localStorage.removeItem('oauth_role'); } catch (e) { /* ignore */ }
              navigate(`/${desiredRole}`);
            } catch (e) {
              console.error('Failed to auto-assign OAuth role:', e);
              // fallback to showing the dialog
              setShowRoleDialog(true);
            }
          } else {
            setShowRoleDialog(true);
            try { localStorage.removeItem('oauth_provider'); } catch (e) { /* ignore */ }
          }
        } else {
          // default for users with no role is client
          navigate('/client');
        }
      } catch (e) {
        console.error('Error during role resolution flow:', e);
        navigate('/client');
      }
    })();
  }, [user, navigate, refreshRole]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        toast.success("Welcome back!");
      } else {
        // Client-side validation
        if (!fullName || fullName.trim().length < 2) {
          toast.error("Please provide your full name.");
          setLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          toast.error("Passwords do not match.");
          setLoading(false);
          return;
        }

        const strength = passwordStrength(password);
        if (strength < 60) {
          toast.error("Password is too weak. Use at least 8 chars, include a number and a symbol.");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: selectedRole
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;

        // Create user role record if user was created
        if (data.user) {
          const { error: roleError } = await supabase
            .from("user_roles")
            .insert({
              user_id: data.user.id,
              role: selectedRole,
            });

          if (roleError) {
            console.error("Error creating user role:", roleError);
            // Don't throw here as the user was created successfully
          }
        }

        toast.success("Account created! Please check your email to verify.");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const startOAuthWithRole = async (roleChoice: "client" | "coach") => {
    try {
      // store desired role and provider flag so on return we can auto-assign
      try { localStorage.setItem('oauth_provider', 'google'); localStorage.setItem('oauth_role', roleChoice); } catch (e) { /* ignore */ }
      setIsFromOAuth(true);
      setOauthRolePromptOpen(false);
      setOauthLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth`,
          scopes: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/calendar.readonly'
          ].join(' '),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        },
      });

      if (error) throw error;
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Google sign-in failed");
      setOauthLoading(false);
      setIsFromOAuth(false);
      try { localStorage.removeItem('oauth_provider'); localStorage.removeItem('oauth_role'); } catch (e) { /* ignore */ }
    }
  };

  const handleGoogleAuth = async () => {
    // If user already picked a desired OAuth role before, start immediately
    let desired: string | null = null;
    try { desired = localStorage.getItem('oauth_role'); } catch (e) { desired = null; }
    if (desired === 'client' || desired === 'coach') {
      await startOAuthWithRole(desired as "client" | "coach");
      return;
    }

    // Otherwise prompt user to pick role first
    setOauthRolePromptOpen(true);
  };

  const handleRoleSubmit = async () => {
    if (!user) return;
    setSubmittingRole(true);

    try {
      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert(
          {
            user_id: user.id,
            role: pendingRole,
          },
          { onConflict: "user_id" }
        );

      if (roleError) throw roleError;

      const { error: metadataError } = await supabase.auth.updateUser({
        data: { role: pendingRole },
      });

      if (metadataError) throw metadataError;

      await refreshRole();
      setShowRoleDialog(false);
      toast.success("Role selected successfully");
      navigate(`/${pendingRole}`);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to set role");
    } finally {
      setSubmittingRole(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      {/* Theme Toggle - Top Right */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl overflow-hidden">
            <img src={expertsLogo} alt="Experts Coaching Hub" className="w-full h-full object-contain" />
          </div>
          <CardTitle className="text-2xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {isLogin ? "Welcome Back" : "Join Experts Coaching Hub"}
          </CardTitle>
          <CardDescription>
            {isLogin ? "Sign in to your account" : "Create your account to begin learning or teaching"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">I want to join as a</Label>
                  <Select value={selectedRole} onValueChange={(value: "client" | "coach") => setSelectedRole(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <div>
                            <div className="font-medium">Student</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="coach">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          <div>
                            <div className="font-medium">Coach</div>
                           </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={isLogin ? undefined : 8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              { !isLogin && (
                <div className="text-xs text-muted-foreground">Use at least 8 characters including a number and a symbol.</div>
              ) }
            </div>

            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>

                <div className="mt-2">
                  <div className="h-2 w-full bg-muted-foreground/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r from-yellow-400 to-green-400 transition-all`}
                      style={{ width: `${passwordStrength(password)}%` }}
                    />
                  </div>
                </div>
              </>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
              disabled={loading}
            >
              {loading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
            </Button>
          </form>
          <div className="relative my-6">
            <Separator className="my-6" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-background px-3 text-xs text-muted-foreground uppercase tracking-wide">
                or continue with
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleAuth}
            disabled={loading || oauthLoading}
          >
            {oauthLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Continue with Google
          </Button>

          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Select your role</DialogTitle>
            <DialogDescription>
              Choose how you would like to use Experts Coaching Hub.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Label htmlFor="oauth-role">I want to join as a</Label>
            <Select value={pendingRole} onValueChange={(value: "client" | "coach") => setPendingRole(value)}>
              <SelectTrigger id="oauth-role">
                <SelectValue placeholder="Select your role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Student</div>
                      <div className="text-xs text-muted-foreground">Learn from expert coaches</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="coach">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Coach</div>
                      <div className="text-xs text-muted-foreground">Create and teach courses</div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                setShowRoleDialog(false);
                await signOut();
              }}
              disabled={submittingRole}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleRoleSubmit} disabled={submittingRole}>
              {submittingRole && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
