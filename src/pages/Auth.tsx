import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users, BookOpen, Loader2 } from "lucide-react";
import expertsLogo from "@/assets/experts-logo.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { resolvePostAuthRoute } from "@/lib/authRouting";

const passwordStrength = (pwd: string) => {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8) score += 25;
  if (pwd.length >= 12) score += 15;
  if (/[A-Z]/.test(pwd)) score += 15;
  if (/[a-z]/.test(pwd)) score += 10;
  if (/\d/.test(pwd)) score += 15;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 20;
  return Math.min(100, score);
};

const getPasswordStrengthLabel = (score: number): { label: string; color: string } => {
  if (score < 40) return { label: "Weak", color: "bg-red-500" };
  if (score < 60) return { label: "Fair", color: "bg-yellow-500" };
  if (score < 80) return { label: "Good", color: "bg-blue-500" };
  return { label: "Strong", color: "bg-green-500" };
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, status, signOut } = useAuth();
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Real-time validation with debouncing
  const validateField = useCallback((fieldName: string, value: string) => {
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    validationTimeoutRef.current = setTimeout(() => {
      const newErrors: Record<string, string> = {};

      if (fieldName === "fullName" && !isLogin) {
        if (!value || value.trim().length === 0) {
          newErrors.fullName = "Full name is required.";
        } else if (value.trim().length < 2) {
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
          } else if (/^\s|\s$/.test(sanitized)) {
            newErrors.fullName = "Full name cannot start or end with spaces.";
          } else if (sanitized.split(' ').length < 2) {
            newErrors.fullName = "Please provide both first and last name.";
          }
        }
      }

      if (fieldName === "email") {
        const trimmedValue = value.trim();
        if (!trimmedValue) {
          newErrors.email = "Email is required.";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)) {
          newErrors.email = "Please enter a valid email address.";
        } else if (trimmedValue.length > 255) {
          newErrors.email = "Email is too long.";
        }
      }

      if (fieldName === "password") {
        if (!value || value.length === 0) {
          newErrors.password = "Password is required.";
        } else if (value.length < 8) {
          newErrors.password = "Password must be at least 8 characters.";
        } else if (value.length > 128) {
          newErrors.password = "Password is too long (max 128 characters).";
        } else if (!isLogin) {
          const strength = passwordStrength(value);
          if (strength < 40) {
            newErrors.password = "Password is too weak. Include uppercase, lowercase, numbers, and symbols.";
          }
        }
      }

      if (fieldName === "confirmPassword" && !isLogin) {
        if (!value || value.length === 0) {
          newErrors.confirmPassword = "Please confirm your password.";
        } else if (value !== password) {
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
    if (location.pathname === "/auth/onboarding") {
      setIsLogin(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!user || !role || status !== "authenticated") {
      return;
    }

    const intendedPath = (location.state as { from?: string } | null)?.from;
    navigate(resolvePostAuthRoute(role, intendedPath), { replace: true });
  }, [location.state, navigate, role, status, user]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      if (isLogin) {
        const trimmedEmail = email.trim().toLowerCase();
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (error) {
          throw new Error(error.message || "Unable to sign in. Please try again.");
        }
        
        // Navigation is handled by the useEffect that watches status + role
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

        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
          newErrors.email = "Email is required.";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
          newErrors.email = "Please enter a valid email address.";
        } else if (trimmedEmail.length > 255) {
          newErrors.email = "Email is too long.";
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
        toast.success("Account created successfully!");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setLoading(false);
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
              You're currently signed in as {role}. Choose an option below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => navigate(resolvePostAuthRoute(role))} className="w-full">Go to Dashboard</Button>
            <Button
              onClick={async () => {
                await signOut();
                toast.success("Signed out successfully");
                window.location.reload();
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/10 p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/10 blur-[100px] pointer-events-none" />

      <div className="absolute top-4 right-4 z-10"><ThemeToggle /></div>

      <div className="w-full max-w-md transition-all duration-500 ease-in-out transform">
        <Card className="shadow-2xl bg-background/60 backdrop-blur-xl border-white/20 dark:border-white/10 relative overflow-hidden max-h-[85vh] flex flex-col">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent dark:from-white/5 pointer-events-none" />
          <CardHeader className="space-y-2 text-center relative z-10 pt-4 pb-3 flex-shrink-0">
            <div className="mx-auto w-12 h-12 rounded-2xl overflow-hidden shadow-inner bg-background p-2 transition-transform hover:scale-105 duration-300">
              <img src={expertsLogo} alt="Experts Coaching Hub" className="w-full h-full object-contain" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {isLogin ? "Welcome Back" : "Join the Hub"}
              </CardTitle>
              <CardDescription className="text-xs font-medium">
                {isLogin ? "Sign in to your account" : "Create your account to begin learning or teaching"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 pb-4 overflow-y-auto flex-1 custom-scrollbar">
          <form onSubmit={handleAuth} className="space-y-2.5">
            {!isLogin && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-sm">Full Name</Label>
                  <Input id="fullName" type="text" placeholder="John Doe" value={fullName}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFullName(value);
                      validateField("fullName", value);
                    }}
                    onBlur={(e) => { validateField("fullName", e.target.value); }}
                    required aria-invalid={!!errors.fullName} aria-describedby={errors.fullName ? "fullName-error" : undefined}
                    className={errors.fullName ? "border-destructive" : ""}
                  />
                  {errors.fullName && <p id="fullName-error" className="text-xs text-destructive" role="alert" aria-live="polite">{errors.fullName}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="role" className="text-sm">I want to join as a</Label>
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
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email}
                onChange={(e) => {
                  const value = e.target.value;
                  setEmail(value);
                  validateField("email", value);
                }}
                onBlur={(e) => { validateField("email", e.target.value); }}
                required aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && <p id="email-error" className="text-xs text-destructive" role="alert" aria-live="polite">{errors.email}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPassword(value);
                    if (value) {
                      validateField("password", value);
                      if (confirmPassword) validateField("confirmPassword", confirmPassword);
                    } else {
                      setErrors(prev => ({ ...prev, password: "" }));
                    }
                  }}
                  onBlur={(e) => { if (e.target.value) validateField("password", e.target.value); }}
                  required
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : (!isLogin ? "password-help" : undefined)}
                  className={errors.password ? "border-destructive pr-16" : "pr-16"}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground min-h-[36px] min-w-[36px] flex items-center justify-center" aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {errors.password && <p id="password-error" className="text-xs text-destructive" role="alert" aria-live="polite">{errors.password}</p>}
              {!isLogin && !errors.password && (
                <div className="text-xs text-muted-foreground">
                  <ul className="flex flex-wrap gap-x-3 gap-y-0.5">
                    <li className={password.length >= 8 ? "text-green-600 dark:text-green-400" : ""}>8+ chars</li>
                    <li className={/[A-Z]/.test(password) ? "text-green-600 dark:text-green-400" : ""}>Upper</li>
                    <li className={/[a-z]/.test(password) ? "text-green-600 dark:text-green-400" : ""}>Lower</li>
                    <li className={/\d/.test(password) ? "text-green-600 dark:text-green-400" : ""}>Number</li>
                    <li className={/[^A-Za-z0-9]/.test(password) ? "text-green-600 dark:text-green-400" : ""}>Symbol</li>
                  </ul>
                </div>
              )}
            </div>
            {!isLogin && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="confirmPassword" className="text-sm">Confirm Password</Label>
                  <Input id="confirmPassword" type={showPassword ? "text" : "password"} placeholder="••••••••" value={confirmPassword}
                    onChange={(e) => {
                      const value = e.target.value;
                      setConfirmPassword(value);
                      validateField("confirmPassword", value);
                    }}
                    onBlur={(e) => { validateField("confirmPassword", e.target.value); }}
                    required aria-invalid={!!errors.confirmPassword}
                    aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
                    className={errors.confirmPassword ? "border-destructive" : ""}
                  />
                  {errors.confirmPassword && <p id="confirmPassword-error" className="text-xs text-destructive" role="alert" aria-live="polite">{errors.confirmPassword}</p>}
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 w-full bg-muted-foreground/10 rounded-full overflow-hidden" role="progressbar" aria-valuenow={passwordStrength(password)} aria-valuemin={0} aria-valuemax={100}>
                    <div className={`h-full transition-all ${getPasswordStrengthLabel(passwordStrength(password)).color}`} style={{ width: `${passwordStrength(password)}%` }} aria-hidden="true" />
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">
                      Strength: <span className={`font-medium ${getPasswordStrengthLabel(passwordStrength(password)).color.replace('bg-', 'text-')}`}>{getPasswordStrengthLabel(passwordStrength(password)).label}</span>
                    </p>
                  </div>
                </div>
              </>
            )}
            <Button type="submit" className="w-full h-10 text-sm font-medium shadow-md transition-all hover:shadow-lg bg-gradient-to-r from-primary to-accent hover:opacity-90" disabled={loading} aria-busy={loading} aria-live="polite">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (isLogin ? "Sign In" : "Sign Up")}
            </Button>
            {isLogin && (
              <p className="text-center text-xs">
                <Link to="/forgot-password" className="text-primary hover:underline">
                  Forgot your password?
                </Link>
              </p>
            )}
          </form>
          <div className="mt-3 text-center text-xs font-medium flex-shrink-0">
            <button type="button" onClick={() => {
              setIsLogin(!isLogin);
              setErrors({});
              setFullName("");
              setPassword("");
              setConfirmPassword("");
            }} className="text-primary hover:text-accent transition-colors">
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
