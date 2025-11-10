import React, { useState, useEffect, useRef, useCallback } from "react";
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { user, role, refreshRole, signOut } = useAuth();
  const hasInitialized = useRef(false);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    }, 300); // 300ms debounce
  }, [isLogin, password]);

  // Cleanup validation timeout on unmount
  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!user) {
      hasInitialized.current = false;
      return;
    }
    
    // Prevent infinite loop - only run once per user session
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Only handle redirects when explicitly on the /auth page
    // This prevents interfering with other routes during page reload
    if (window.location.pathname !== '/auth') {
      return;
    }

    // If role already set and user is on auth page, show "already logged in" message
    if (role) {
      return;
    }

    let isMounted = true;

    (async () => {
      try {
        // Ensure we refresh the role from DB first to avoid race conditions
        await refreshRole();

        // Check if component is still mounted
        if (!isMounted) return;

        // Re-check role directly from DB to avoid stale closure values
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (!isMounted) return;

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
              // upsert user role via secure RPC (self-only)
              const { data: rpcData, error: rpcError } = await supabase
                .rpc('upsert_own_role', { p_role: desiredRole });
              if (rpcError || (rpcData && typeof rpcData === 'object' && 'success' in rpcData && rpcData.success === false)) {
                const errorMsg = rpcError?.message || (rpcData && typeof rpcData === 'object' && 'error' in rpcData && typeof rpcData.error === 'string' ? rpcData.error : 'Failed to set role');
                throw new Error(errorMsg);
              }

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
          if (isMounted) {
            navigate('/client');
          }
        }
      } catch (e) {
        console.error('Error during role resolution flow:', e);
        if (isMounted) {
          navigate('/client');
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [user, navigate, refreshRole]);  // refreshRole is stable (memoized with useCallback) so safe to include

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
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
        // Client-side validation and sanitization
        const newErrors: Record<string, string> = {};

        if (!fullName || fullName.trim().length < 2) {
          newErrors.fullName = "Please provide your full name.";
        }

        // Comprehensive sanitization
        const sanitizedFullName = fullName
          .trim()
          .normalize('NFKC')  // Unicode normalization
          .replace(/[^\p{L}\p{M}\s'-]/gu, '')  // Only letters, marks, spaces, hyphens, apostrophes
          .replace(/\s+/g, ' ')  // Collapse multiple spaces
          .slice(0, 100);  // Max length

        // Validation
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
        } else {
          const strength = passwordStrength(password);
          if (strength < 60) {
            newErrors.password = "Password is too weak. Use at least 8 chars, include a number and a symbol.";
          }
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

        const { data, error } = await supabase.auth.signUp({
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

        // Note: User role is automatically created by the handle_new_user trigger
        // based on the role passed in user metadata
        toast.success("Account created successfully!");
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
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('upsert_own_role', { p_role: pendingRole });
      if (rpcError || (rpcData && typeof rpcData === 'object' && 'success' in rpcData && rpcData.success === false)) {
        const errorMsg = rpcError?.message || (rpcData && typeof rpcData === 'object' && 'error' in rpcData && typeof rpcData.error === 'string' ? rpcData.error : 'Failed to set role');
        throw new Error(errorMsg);
      }

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

  // If user is already logged in and has a role, show a message instead of the form
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
            <Button 
              onClick={() => navigate(`/${role}`)} 
              className="w-full"
            >
              Go to Dashboard
            </Button>
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
                    onChange={(e) => {
                      const value = e.target.value;
                      setFullName(value);
                      if (value) {
                        validateField("fullName", value);
                      } else {
                        setErrors(prev => ({ ...prev, fullName: "" }));
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value) {
                        validateField("fullName", e.target.value);
                      }
                    }}
                    required
                    aria-invalid={!!errors.fullName}
                    aria-describedby={errors.fullName ? "fullName-error" : undefined}
                    className={errors.fullName ? "border-destructive" : ""}
                  />
                  {errors.fullName && (
                    <p 
                      id="fullName-error" 
                      className="text-sm text-destructive"
                      role="alert"
                      aria-live="polite"
                    >
                      {errors.fullName}
                    </p>
                  )}
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
                    onChange={(e) => {
                      const value = e.target.value;
                      setEmail(value);
                      if (value) {
                        validateField("email", value);
                      } else {
                        setErrors(prev => ({ ...prev, email: "" }));
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value) {
                        validateField("email", e.target.value);
                      }
                    }}
                required
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && (
                <p 
                  id="email-error" 
                  className="text-sm text-destructive"
                  role="alert"
                  aria-live="polite"
                >
                  {errors.email}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="•••••••���"
                  value={password}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPassword(value);
                    if (value && !isLogin) {
                      validateField("password", value);
                      // Also validate confirm password if it has a value
                      if (confirmPassword) {
                        validateField("confirmPassword", confirmPassword);
                      }
                    } else {
                      setErrors(prev => ({ ...prev, password: "" }));
                    }
                  }}
                  onBlur={(e) => {
                    if (e.target.value && !isLogin) {
                      validateField("password", e.target.value);
                    }
                  }}
                  required
                  minLength={isLogin ? undefined : 8}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : (!isLogin ? "password-help" : undefined)}
                  className={errors.password ? "border-destructive pr-20" : "pr-20"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {errors.password && (
                <p 
                  id="password-error" 
                  className="text-sm text-destructive"
                  role="alert"
                  aria-live="polite"
                >
                  {errors.password}
                </p>
              )}
              {!isLogin && !errors.password && (
                <p id="password-help" className="text-xs text-muted-foreground">
                  Use at least 8 characters including a number and a symbol.
                </p>
              )}
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
                    onChange={(e) => {
                      const value = e.target.value;
                      setConfirmPassword(value);
                      if (value) {
                        validateField("confirmPassword", value);
                      } else {
                        setErrors(prev => ({ ...prev, confirmPassword: "" }));
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value) {
                        validateField("confirmPassword", e.target.value);
                      }
                    }}
                    required
                    minLength={8}
                    aria-invalid={!!errors.confirmPassword}
                    aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
                    className={errors.confirmPassword ? "border-destructive" : ""}
                  />
                  {errors.confirmPassword && (
                    <p 
                      id="confirmPassword-error" 
                      className="text-sm text-destructive"
                      role="alert"
                      aria-live="polite"
                    >
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>

                <div className="mt-2">
                  <div 
                    className="h-2 w-full bg-muted-foreground/10 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={passwordStrength(password)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Password strength: ${passwordStrength(password) < 30 ? "Weak" : passwordStrength(password) < 60 ? "Fair" : passwordStrength(password) < 80 ? "Good" : "Strong"}`}
                  >
                    <div
                      className={`h-full bg-gradient-to-r from-yellow-400 to-green-400 transition-all`}
                      style={{ width: `${passwordStrength(password)}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="sr-only">
                    Password strength: {passwordStrength(password) < 30 ? "Weak" : passwordStrength(password) < 60 ? "Fair" : passwordStrength(password) < 80 ? "Good" : "Strong"}
                  </p>
                </div>
              </>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
              disabled={loading}
              aria-busy={loading}
              aria-live="polite"
            >
              {loading ? (
                <>
                  <span className="sr-only">Loading, please wait</span>
                  Loading...
                </>
              ) : (
                isLogin ? "Sign In" : "Sign Up"
              )}
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

      {/* Pre-OAuth role prompt (shown before redirect) */}
      <Dialog open={oauthRolePromptOpen} onOpenChange={setOauthRolePromptOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Before you continue</DialogTitle>
            <DialogDescription>Pick a role so we can create your account correctly after Google sign-in.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Label htmlFor="pre-oauth-role">I want to join as a</Label>
            <Select value={pendingRole} onValueChange={(value: "client" | "coach") => setPendingRole(value)}>
              <SelectTrigger id="pre-oauth-role">
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
            <Button type="button" variant="ghost" onClick={() => setOauthRolePromptOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => startOAuthWithRole(pendingRole)}>
              Continue with Google
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post-OAuth role dialog (fallback if no preselected role) */}
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
