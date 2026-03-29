import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, RotateCw, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthService } from "@/hooks/useAuthService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { clearOAuthCallbackState, clearOAuthCallbackUrl, readOAuthCallbackState, resolveOAuthCallbackNextPath } from "@/lib/oauthCallback";

type OAuthFinalizeResponse = {
  role: "client" | "coach" | "admin";
  onboarding_state: "ready" | "role_bootstrapped" | "needs_role_selection";
  redirect_to: string;
  finalized_for_session: boolean;
};

const makeSupportCode = () => `OAUTH-${Date.now().toString(36).toUpperCase()}`;

const hasProviderCallbackParams = (url: URL) => {
  const hashParams = new URLSearchParams(url.hash.replace("#", "?"));
  const searchParams = url.searchParams;

  return (
    searchParams.has("code") ||
    searchParams.has("error") ||
    searchParams.has("state") ||
    hashParams.has("access_token") ||
    hashParams.has("error")
  );
};

export default function AuthCallback() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [supportCode, setSupportCode] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { finalizeAuthAndResolveRole, signOut } = useAuthService();

  const oauthState = useMemo(() => readOAuthCallbackState(), []);

  const finalizeOAuthCallback = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    setSupportCode(null);

    const url = new URL(window.location.href);
    if (!hasProviderCallbackParams(url)) {
      clearOAuthCallbackUrl();
      setLoading(false);
      setErrorMessage("This callback URL is missing OAuth provider parameters.");
      return;
    }

    const nonceFromUrl = url.searchParams.get("nonce");
    if (!nonceFromUrl || !oauthState.nonce || nonceFromUrl !== oauthState.nonce) {
      clearOAuthCallbackUrl();
      const code = makeSupportCode();
      setSupportCode(code);
      setLoading(false);
      setErrorMessage("OAuth callback validation failed. Please retry sign-in.");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke<OAuthFinalizeResponse>("oauth-callback", {
        body: {
          callback_nonce: nonceFromUrl,
        },
      });

      if (error || !data) {
        throw new Error(error?.message || "Unable to finalize OAuth callback.");
      }

      if (data.onboarding_state === "needs_role_selection") {
        throw new Error("Account onboarding is incomplete. Please contact support.");
      }

      const finalized = await finalizeAuthAndResolveRole({
        intendedPath: oauthState.intendedPath ?? (location.state as { from?: string } | null)?.from ?? data.redirect_to,
      });

      clearOAuthCallbackState();
      clearOAuthCallbackUrl();

      navigate(resolveOAuthCallbackNextPath(finalized.role ?? data.role, finalized.intendedPath), { replace: true });
    } catch (error: unknown) {
      clearOAuthCallbackUrl();
      const code = makeSupportCode();
      setSupportCode(code);
      setErrorMessage(error instanceof Error ? error.message : "OAuth sign-in could not be completed.");
      toast.error("OAuth sign-in could not be completed.");
    } finally {
      setLoading(false);
    }
  }, [finalizeAuthAndResolveRole, location.state, navigate, oauthState.intendedPath, oauthState.nonce]);

  useEffect(() => {
    void finalizeOAuthCallback();
  }, [finalizeOAuthCallback]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Completing sign-in
            </CardTitle>
            <CardDescription>Please wait while we finalize your OAuth login.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              OAuth callback failed
            </CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {supportCode ? (
              <p className="text-sm text-muted-foreground">
                Support code: <span className="font-mono">{supportCode}</span>
              </p>
            ) : null}
            <Button onClick={() => void finalizeOAuthCallback()} className="w-full">
              <RotateCw className="h-4 w-4 mr-2" />
              Retry callback finalize
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                clearOAuthCallbackState();
                await signOut({ scope: "local", redirectTo: "/auth", replace: true });
              }}
            >
              Return to sign-in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
