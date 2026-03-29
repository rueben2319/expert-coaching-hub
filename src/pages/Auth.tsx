import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Users, BookOpen, Mail, Loader2 } from "lucide-react";
import expertsLogo from "@/assets/experts-logo.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { resolvePostAuthRoute } from "@/lib/authRouting";

const passwordStrength = (pwd: string) => {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8) score += 40;
  if (/[A-Z]/.test(pwd)) score += 15;
  if (/\d/.test(pwd)) score += 20;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 25;
  return Math.min(100, score);
};

type OAuthFinalizeResponse = {
  role: "client" | "coach" | "admin";
  onboarding_state: "ready" | "needs_role_selection";
  redirect_to: string;
};

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<"client" | "coach">("client");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthCallbackPending, setOauthCallbackPending] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, status, signOut } = useAuth();
  const oauthFinalizeAttempted = useRef(false);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleOAuthCallbackFinalize = useCallback(async () => {
    if (!user || oauthFinalizeAttempted.current) return;

    oauthFinalizeAttempted.current = true;

    try {
      const { data, error } = await supabase.functions.invoke<OAuthFinalizeResponse>("oauth-callback", {
        body: {},
      });

      if (error || !data) {
        throw new Error(error?.message || "Unable to finalize OAuth callback.");
      }

      if (data.onboarding_state === "needs_role_selection") {
        toast.error("Account onboarding is incomplete. Please contact support.");
        await signOut();
        return;
      }

      const nextPath = resolvePostAuthRoute(data.role, data.redirect_to);
      window.history.replaceState({}, document.title, "/auth");
      navigate(nextPath, { replace: true });
    } catch (error: any) {
      toast.error(error?.message || "OAuth sign-in could not be completed.");
      oauthFinalizeAttempted.current = false;
    } finally {
      setOauthCallbackPending(false);
      setOauthLoading(false);
    }
  }, [navigate, signOut, user]);

  // Real-time validation with debouncing
  const validateField = useCallback((fieldName: string, value: string) => {
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    validationTimeoutRef.current = setTimeout(() => {
      const newErrors: Record<string, string> = {};

      if (fieldName === "fullName" && !isLogin) {
        if (!value || value.trim().length < 2) {
          newErrors.fullName = "Full name must be at least 2 characters.";
        } else if (value.trim().length > 100) {
          newErrors.fullName = "Full name must be less than 100 characters.";
        } else {
          const sanitized = value
            .trim()
            .normalize('NFKC')
            .replace(/[^\p{L}\p{M}\s'-]/gu, '')
            .replace(/\s+/g, ' ');
          if (!/^[\p{L}\p{M}\s'-]+$/u.test(sanitized)) {
            newErrors.fullName = "Full name can only contain letters, spaces, hyphens, and apostrophes.";
          }
        }
      }

      if (fieldName === "email") {
        if (!value || !value.trim()) {
          newErrors.email = "Email is required.";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
          newErrors.email = "Please enter a valid email address.";
        }
      }

      if (fieldName === "password" && !isLogin) {
        if (!value || value.length < 8) {
          newErrors.password = "Password must be at least 8 characters.";
        } else {
          const strength = passwordStrength(value);
          if (strength < 60) {
            newErrors.password = "Password is too weak. Use at least 8 chars, include a number and a symbol.";
          }
        }
      }

      if (fieldName === "confirmPassword" && !isLogin) {
        if (value !== password) {
          newErrors.confirmPassword = "Passwords do not match.";
        }
      }

      setErrors(prev => {
        const updated = { ...prev };
        if (newErrors[fieldName]) {
          updated[fieldName] = newErrors[fieldName];
        } else {
          delete updated[fieldName];
        }
        return updated;
      });
    }, 300);
  }, [isLogin, password]);

  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
    const hasOAuthParams = urlParams.has('code') || hashParams.has('access_token') || hashParams.has('error');

    if (hasOAuthParams) {
      setOauthLoading(true);
      setOauthCallbackPending(true);
    } else {
      setOauthLoading(false);
      setOauthCallbackPending(false);
    }
  }, []);

  useEffect(() => {
    if (location.pathname === "/auth/onboarding") {
      setIsLogin(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!oauthCallbackPending || !user) return;
    void handleOAuthCallbackFinalize();
  }, [oauthCallbackPending, user, handleOAuthCallbackFinalize]);

  useEffect(() => {
    if (!user || !role || oauthCallbackPending || status !== "authenticated") {
      return;
    }

    const intendedPath = (location.state as { from?: string } | null)?.from;
    navigate(resolvePostAuthRoute(role, intendedPath), { replace: true });
  }, [location.state, navigate, oauthCallbackPending, role, status, user]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      if (isLogin) {
        const normalizedEmail = email.trim().toLowerCase();

        const { data, error } = await supabase.functions.invoke("auth-login", {
          body: {
            email: normalizedEmail,
            password,
          },
        });

        if (error) {
          const message =
            typeof data?.error === "string"
              ? data.error
              : error.message || "Unable to sign in. Please try again.";
          throw new Error(message);
        }

        const session = data?.session;
        if (!session?.access_token || !session?.refresh_token) {
          throw new Error("Authentication endpoint did not return a valid session.");
        }

        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });

        if (setSessionError) throw setSessionError;

        await supabase.auth.refreshSession();
        const { data: updatedSession } = await supabase.auth.getSession();
        const sessionRole = updatedSession.session?.user?.app_metadata?.role;
        navigate(
          resolvePostAuthRoute(
            sessionRole === "client" || sessionRole === "coach" || sessionRole === "admin"
              ? sessionRole
              : null,
            (location.state as { from?: string } | null)?.from
          )
        );

        toast.success("Welcome back!");
      } else {
        const newErrors: Record<string, string> = {};

        if (!fullName || fullName.trim().length < 2) {
          newErrors.fullName = "Please provide your full name.";
        }

        const sanitizedFullName = fullName
          .trim()
          .normalize('NFKC')
          .replace(/[^\p{L}\p{M}\s'-]/gu, '')
          .replace(/\s+/g, ' ')
          .slice(0, 100);

        if (!newErrors.fullName) {
          if (sanitizedFullName.length < 2 || sanitizedFullName.length > 100) {
            newErrors.fullName = "Full name must be between 2 and 100 characters.";
          } else if (!/^[\p{L}\p{M}\s'-]+$/u.test(sanitizedFullName)) {
            newErrors.fullName = "Full name can only contain letters, spaces, hyphens, and apostrophes.";
          } else if (/^\s|\s$/.test(sanitizedFullName)) {
            newErrors.fullName = "Full name cannot start or end with spaces.";
          }
        }

        if (!email || !email.trim()) {
          newErrors.email = "Email is required.";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
          newErrors.email = "Please enter a valid email address.";
        }

        if (!password || password.length < 8) {
          newErrors.password = "Password must be at least 8 characters.";
        } else if (passwordStrength(password) < 60) {
          newErrors.password = "Password is too weak. Use at least 8 chars, include a number and a symbol.";
        }

        if (password !== confirmPassword) {
          newErrors.confirmPassword = "Passwords do not match.";
        }

        if (Object.keys(newErrors).length > 0) {
          setErrors(newErrors);
          toast.error("Please check the form for errors.");
          setLoading(false);
          return;
        }

        const { data: signUpData, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              full_name: sanitizedFullName,
              role: selectedRole
            },
          },
        });

        if (error) throw error;

        if (signUpData.user && signUpData.session?.access_token) {
          const { error: roleAssignError } = await supabase.functions.invoke("upsert-user-role", {
            body: {
              user_id: signUpData.user.id,
              role: selectedRole,
              reason: "signup_onboarding",
            },
            headers: {
              Authorization: `Bearer ${signUpData.session.access_token}`,
            },
          });

          if (roleAssignError) {
            throw new Error(roleAssignError.message || "Failed to complete role onboarding.");
          }
        }

        toast.success("Account created successfully!");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setOauthLoading(true);

      const redirectUrl = `${window.location.origin}/auth`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          scopes: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/calendar.readonly'
          ].join(' '),
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account'
          }
        },
      });

      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (error: any) {
      toast.error(error.message || "Google sign-in failed");
      setOauthLoading(false);
    }
  };

  if (user && role) {
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
            <CardTitle className="text-2xl">Already Logged In</CardTitle>
            <CardDescription>
              You're currently signed in. Choose an option below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => navigate(resolvePostAuthRoute(role))} className="w-full">Go to Dashboard</Button>
            <Button
              onClick={async () => {
                await signOut();
                toast.success("Signed out successfully");
              }}
              variant="outline"
              className="w-full"
            >
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
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
                  <Input id="fullName" type="text" placeholder="John Doe" value={fullName}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFullName(value);
                      if (value) validateField("fullName", value); else setErrors(prev => ({ ...prev, fullName: "" }));
                    }}
                    onBlur={(e) => { if (e.target.value) validateField("fullName", e.target.value); }}
                    required aria-invalid={!!errors.fullName} aria-describedby={errors.fullName ? "fullName-error" : undefined}
                    className={errors.fullName ? "border-destructive" : ""}
                  />
                  {errors.fullName && <p id="fullName-error" className="text-sm text-destructive" role="alert" aria-live="polite">{errors.fullName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">I want to join as a</Label>
                  <Select value={selectedRole} onValueChange={(value: "client" | "coach") => setSelectedRole(value)}>
                    <SelectTrigger><SelectValue placeholder="Select your role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client"><div className="flex items-center gap-2"><Users className="h-4 w-4" /><div><div className="font-medium">Student</div></div></div></SelectItem>
                      <SelectItem value="coach"><div className="flex items-center gap-2"><BookOpen className="h-4 w-4" /><div><div className="font-medium">Coach</div></div></div></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email}
                onChange={(e) => {
                  const value = e.target.value;
                  setEmail(value);
                  if (value) validateField("email", value); else setErrors(prev => ({ ...prev, email: "" }));
                }}
                onBlur={(e) => { if (e.target.value) validateField("email", e.target.value); }}
                required aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && <p id="email-error" className="text-sm text-destructive" role="alert" aria-live="polite">{errors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPassword(value);
                    if (value && !isLogin) {
                      validateField("password", value);
                      if (confirmPassword) validateField("confirmPassword", confirmPassword);
                    } else {
                      setErrors(prev => ({ ...prev, password: "" }));
                    }
                  }}
                  onBlur={(e) => { if (e.target.value && !isLogin) validateField("password", e.target.value); }}
                  required minLength={isLogin ? undefined : 8}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : (!isLogin ? "password-help" : undefined)}
                  className={errors.password ? "border-destructive pr-20" : "pr-20"}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {errors.password && <p id="password-error" className="text-sm text-destructive" role="alert" aria-live="polite">{errors.password}</p>}
              {!isLogin && !errors.password && <p id="password-help" className="text-xs text-muted-foreground">Use at least 8 characters including a number and a symbol.</p>}
            </div>
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input id="confirmPassword" type={showPassword ? "text" : "password"} placeholder="••••••••" value={confirmPassword}
                    onChange={(e) => {
                      const value = e.target.value;
                      setConfirmPassword(value);
                      if (value) validateField("confirmPassword", value); else setErrors(prev => ({ ...prev, confirmPassword: "" }));
                    }}
                    onBlur={(e) => { if (e.target.value) validateField("confirmPassword", e.target.value); }}
                    required minLength={8} aria-invalid={!!errors.confirmPassword}
                    aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
                    className={errors.confirmPassword ? "border-destructive" : ""}
                  />
                  {errors.confirmPassword && <p id="confirmPassword-error" className="text-sm text-destructive" role="alert" aria-live="polite">{errors.confirmPassword}</p>}
                </div>
                <div className="mt-2">
                  <div className="h-2 w-full bg-muted-foreground/10 rounded-full overflow-hidden" role="progressbar" aria-valuenow={passwordStrength(password)} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full bg-gradient-to-r from-yellow-400 to-green-400 transition-all" style={{ width: `${passwordStrength(password)}%` }} aria-hidden="true" />
                  </div>
                </div>
              </>
            )}
            <Button type="submit" className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity" disabled={loading} aria-busy={loading} aria-live="polite">
              {loading ? <>Loading...</> : (isLogin ? "Sign In" : "Sign Up")}
            </Button>
            {isLogin ? (
              <p className="text-center text-sm">
                <Link to="/forgot-password" className="text-primary hover:underline">
                  Forgot your password?
                </Link>
              </p>
            ) : null}
          </form>
          <div className="relative my-6">
            <Separator className="my-6" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-background px-3 text-xs text-muted-foreground uppercase tracking-wide">or continue with</span>
            </div>
          </div>
          <Button type="button" variant="outline" className="w-full" onClick={handleGoogleAuth} disabled={loading || oauthLoading}>
            {oauthLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
            Continue with Google
          </Button>
          <div className="mt-4 text-center text-sm">
            <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline">
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
