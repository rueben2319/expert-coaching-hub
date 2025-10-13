import { useState, useEffect } from "react";
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
  const navigate = useNavigate();
  const { user, role, refreshRole, signOut } = useAuth();

  useEffect(() => {
    if (user && role) {
      navigate(`/${role}`);
    }
  }, [user, role, navigate]);

  useEffect(() => {
    if (user && !role) {
      (async () => {
        try {
          // Obtain session and identities to determine if this was an OAuth (Google) sign-in
          const { data: { session } } = await supabase.auth.getSession();

          const sessionProvider = (session as any)?.provider || null;
          const hasProviderToken = Boolean((session as any)?.provider_token);

          const identityProvider = Array.isArray((user as any).identities)
            ? (user as any).identities.find((i: any) => i.provider === 'google')
            : null;

          const isOAuthUser = Boolean(
            sessionProvider === 'google' ||
            identityProvider ||
            user.app_metadata?.provider === 'google' ||
            user.user_metadata?.provider === 'google' ||
            (hasProviderToken && !!identityProvider)
          );

          if (isOAuthUser) {
            setShowRoleDialog(true);
          } else {
            // For traditional users without roles, redirect to client dashboard
            navigate('/client');
          }
        } catch (e) {
          console.error('Error detecting auth provider for role flow:', e);
          navigate('/client');
        }
      })();
    }
  }, [user, role, navigate]);

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

  const handleGoogleAuth = async () => {
    try {
      setOauthLoading(true);
      setIsFromOAuth(true);
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
    }
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
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
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
