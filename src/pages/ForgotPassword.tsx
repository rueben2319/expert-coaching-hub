import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import expertsLogo from "@/assets/experts-logo.png";

const RESET_PASSWORD_PATH = "/reset-password";
const GENERIC_RESET_MESSAGE = "If an account exists for this email, you'll receive password reset instructions shortly.";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = useMemo(() => `${window.location.origin}${RESET_PASSWORD_PATH}`, []);

  const handleForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (normalizedEmail) {
        await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo,
        });
      }
    } finally {
      toast.success(GENERIC_RESET_MESSAGE);
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
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>
            Enter your email address and we'll send reset instructions if an account exists.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send reset link"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Remembered your password? <Link to="/auth" className="text-primary hover:underline">Back to sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
