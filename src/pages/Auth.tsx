import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users, BookOpen } from "lucide-react";
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, signOut } = useAuth();
  const validationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Redirect if already authenticated with a role
  useEffect(() => {
    if (user && role) {
      const from = (location.state as any)?.from;
      navigate(from || `/${role}`, { replace: true });
    }
  }, [user, role, navigate, location.state]);

  // Real-time validation with debouncing
  const validateField = useCallback((fieldName: string, value: string) => {
    if (validationTimeoutRef.current) clearTimeout(validationTimeoutRef.current);

    validationTimeoutRef.current = setTimeout(() => {
      const newErrors: Record<string, string> = {};

      if (fieldName === "fullName" && !isLogin) {
        if (!value || value.trim().length < 2) {
          newErrors.fullName = "Full name must be at least 2 characters.";
        } else if (value.trim().length > 100) {
          newErrors.fullName = "Full name must be less than 100 characters.";
        } else {
          const sanitized = value.trim().normalize('NFKC').replace(/[^\p{L}\p{M}\s'-]/gu, '').replace(/\s+/g, ' ');
          if (!/^[\p{L}\p{M}\s'-]+$/u.test(sanitized)) {
            newErrors.fullName = "Full name can only contain letters, spaces, hyphens, and apostrophes.";
          }
        }
      }

      if (fieldName === "email") {
        if (!value || !value.trim()) newErrors.email = "Email is required.";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) newErrors.email = "Please enter a valid email address.";
      }

      if (fieldName === "password" && !isLogin) {
        if (!value || value.length < 8) newErrors.password = "Password must be at least 8 characters.";
        else if (passwordStrength(value) < 60) newErrors.password = "Password is too weak. Use at least 8 chars, include a number and a symbol.";
      }

      if (fieldName === "confirmPassword" && !isLogin) {
        if (value !== password) newErrors.confirmPassword = "Passwords do not match.";
      }

      setErrors(prev => {
        const updated = { ...prev };
        if (newErrors[fieldName]) updated[fieldName] = newErrors[fieldName];
        else delete updated[fieldName];
        return updated;
      });
    }, 300);
  }, [isLogin, password]);

  useEffect(() => {
    return () => { if (validationTimeoutRef.current) clearTimeout(validationTimeoutRef.current); };
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      } else {
        // Validate
        const newErrors: Record<string, string> = {};
        if (!fullName || fullName.trim().length < 2) newErrors.fullName = "Please provide your full name.";

        const sanitizedFullName = fullName.trim().normalize('NFKC').replace(/[^\p{L}\p{M}\s'-]/gu, '').replace(/\s+/g, ' ').slice(0, 100);

        if (!newErrors.fullName) {
          if (sanitizedFullName.length < 2 || sanitizedFullName.length > 100) newErrors.fullName = "Full name must be between 2 and 100 characters.";
          else if (!/^[\p{L}\p{M}\s'-]+$/u.test(sanitizedFullName)) newErrors.fullName = "Full name can only contain letters, spaces, hyphens, and apostrophes.";
        }

        if (!email || !email.trim()) newErrors.email = "Email is required.";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) newErrors.email = "Please enter a valid email address.";

        if (!password || password.length < 8) newErrors.password = "Password must be at least 8 characters.";
        else if (passwordStrength(password) < 60) newErrors.password = "Password is too weak. Use at least 8 chars, include a number and a symbol.";

        if (password !== confirmPassword) newErrors.confirmPassword = "Passwords do not match.";

        if (Object.keys(newErrors).length > 0) {
          setErrors(newErrors);
          toast.error("Please check the form for errors.");
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: { full_name: sanitizedFullName, role: selectedRole },
          },
        });

        if (error) throw error;
        toast.success("Account created successfully!");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      toast.error("Please enter your email address.");
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset link sent! Check your email.");
      setShowForgotPassword(false);
      setResetEmail("");
    } catch (error: any) {
      toast.error(error.message || "Failed to send reset email");
    } finally {
      setResetLoading(false);
    }
  };

  // Already logged in
  if (user && role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
        <div className="absolute top-4 right-4"><ThemeToggle /></div>
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl overflow-hidden">
              <img src={expertsLogo} alt="Experts Coaching Hub" className="w-full h-full object-contain" />
            </div>
            <CardTitle className="text-2xl">Already Logged In</CardTitle>
            <CardDescription>You're currently signed in.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => navigate(`/${role}`)} className="w-full">Go to Dashboard</Button>
            <Button onClick={async () => { await signOut(); toast.success("Signed out"); }} variant="outline" className="w-full">Sign Out</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Forgot password form
  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
        <div className="absolute top-4 right-4"><ThemeToggle /></div>
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl overflow-hidden">
              <img src={expertsLogo} alt="Experts Coaching Hub" className="w-full h-full object-contain" />
            </div>
            <CardTitle className="text-2xl">Reset Password</CardTitle>
            <CardDescription>Enter your email and we'll send you a reset link.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resetEmail">Email</Label>
                <Input id="resetEmail" type="email" placeholder="you@example.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={resetLoading}>
                {resetLoading ? "Sending..." : "Send Reset Link"}
              </Button>
              <div className="text-center">
                <button type="button" onClick={() => setShowForgotPassword(false)} className="text-sm text-primary hover:underline">
                  Back to login
                </button>
              </div>
            </form>
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
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => { setFullName(e.target.value); if (e.target.value) validateField("fullName", e.target.value); else setErrors(p => ({ ...p, fullName: "" })); }}
                    onBlur={(e) => { if (e.target.value) validateField("fullName", e.target.value); }}
                    required
                    aria-invalid={!!errors.fullName}
                    aria-describedby={errors.fullName ? "fullName-error" : undefined}
                    className={errors.fullName ? "border-destructive" : ""}
                  />
                  {errors.fullName && <p id="fullName-error" className="text-sm text-destructive" role="alert">{errors.fullName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">I want to join as a</Label>
                  <Select value={selectedRole} onValueChange={(v: "client" | "coach") => setSelectedRole(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span className="font-medium">Student</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="coach">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          <span className="font-medium">Coach</span>
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
                onChange={(e) => { setEmail(e.target.value); if (e.target.value) validateField("email", e.target.value); else setErrors(p => ({ ...p, email: "" })); }}
                onBlur={(e) => { if (e.target.value) validateField("email", e.target.value); }}
                required
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && <p id="email-error" className="text-sm text-destructive" role="alert">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {isLogin && (
                  <button type="button" onClick={() => { setShowForgotPassword(true); setResetEmail(email); }} className="text-xs text-primary hover:underline">
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (e.target.value && !isLogin) { validateField("password", e.target.value); if (confirmPassword) validateField("confirmPassword", confirmPassword); }
                    else setErrors(p => ({ ...p, password: "" }));
                  }}
                  onBlur={(e) => { if (e.target.value && !isLogin) validateField("password", e.target.value); }}
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
              {errors.password && <p id="password-error" className="text-sm text-destructive" role="alert">{errors.password}</p>}
              {!isLogin && !errors.password && <p id="password-help" className="text-xs text-muted-foreground">Use at least 8 characters including a number and a symbol.</p>}
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
                    onChange={(e) => { setConfirmPassword(e.target.value); if (e.target.value) validateField("confirmPassword", e.target.value); else setErrors(p => ({ ...p, confirmPassword: "" })); }}
                    onBlur={(e) => { if (e.target.value) validateField("confirmPassword", e.target.value); }}
                    required
                    minLength={8}
                    aria-invalid={!!errors.confirmPassword}
                    aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
                    className={errors.confirmPassword ? "border-destructive" : ""}
                  />
                  {errors.confirmPassword && <p id="confirmPassword-error" className="text-sm text-destructive" role="alert">{errors.confirmPassword}</p>}
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
                    <div className="h-full bg-gradient-to-r from-yellow-400 to-green-400 transition-all" style={{ width: `${passwordStrength(password)}%` }} />
                  </div>
                </div>
              </>
            )}

            <Button type="submit" className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity" disabled={loading} aria-busy={loading}>
              {loading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <button type="button" onClick={() => { setIsLogin(!isLogin); setErrors({}); }} className="text-primary hover:underline">
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
