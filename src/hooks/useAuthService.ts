import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { googleCalendarService } from "@/integrations/google/calendar";
import { notifyAuthStateChange } from "@/lib/tokenSync";
import { logger } from "@/lib/logger";

export type AuthSignOutOptions = {
  scope?: "global" | "local";
  redirectTo?: string;
  replace?: boolean;
};

type UseAuthServiceOptions = {
  onLocalAuthStateCleared: () => void;
};

export function useAuthService({ onLocalAuthStateCleared }: UseAuthServiceOptions) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const clearClientAuthState = useCallback(() => {
    onLocalAuthStateCleared();
    queryClient.clear();
    googleCalendarService.clearAllCaches();
    notifyAuthStateChange();
  }, [onLocalAuthStateCleared, queryClient]);

  const signOut = useCallback(
    async ({ scope = "local", redirectTo = "/", replace = true }: AuthSignOutOptions = {}) => {
      try {
        const { error } = await supabase.auth.signOut({ scope });
        if (error) {
          logger.error("Error signing out:", error);
        }
      } catch (error) {
        logger.error("Unexpected sign-out error:", error);
      } finally {
        clearClientAuthState();
        navigate(redirectTo, { replace });
      }
    },
    [clearClientAuthState, navigate]
  );

  return {
    signOut,
    clearClientAuthState,
  };
}
