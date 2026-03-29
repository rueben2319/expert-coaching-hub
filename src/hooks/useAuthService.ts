import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { googleCalendarService } from "@/integrations/google/calendar";
import { notifyAuthStateChange } from "@/lib/tokenSync";
import { logger } from "@/lib/logger";

export type UserRole = "client" | "coach" | "admin";

export type AuthSignOutOptions = {
  scope?: "global" | "local";
  redirectTo?: string;
  replace?: boolean;
};

type UseAuthServiceOptions = {
  onLocalAuthStateCleared?: () => void;
};

type RoleResolutionTelemetry = {
  source: "useAuth" | "finalizeAuthAndResolveRole";
  trigger: "bootstrap" | "auth_state_change" | "manual";
};

const isUserRole = (value: unknown): value is UserRole =>
  value === "client" || value === "coach" || value === "admin";

const readRoleFromSessionClaims = (session: Session | null): UserRole | null => {
  const claimRole = (session?.user?.app_metadata?.role as string | undefined) ?? null;
  const metadataRole = (session?.user?.user_metadata?.role as string | undefined) ?? null;
  const resolved = claimRole ?? metadataRole;

  return isUserRole(resolved) ? resolved : null;
};

const getCanonicalRoleFromDb = async (): Promise<UserRole | null> => {
  const { data, error } = await supabase.functions.invoke<{ role?: unknown }>("get-user-role", {
    body: {},
  });

  if (error) {
    logger.error("auth.role.canonical_fetch_failed", { error });
    return null;
  }

  return isUserRole(data?.role) ? data.role : null;
};

export const resolveRoleWithClaimsAndDb = async (
  session: Session | null,
  telemetry: RoleResolutionTelemetry
): Promise<UserRole | null> => {
  const claimRole = readRoleFromSessionClaims(session);
  const dbRole = await getCanonicalRoleFromDb();

  if (!dbRole) {
    return claimRole;
  }

  if (claimRole !== dbRole) {
    logger.warn("auth.role_mismatch.claim_vs_db", {
      ...telemetry,
      claim_role: claimRole,
      db_role: dbRole,
    });

    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      logger.error("auth.role_claim_refresh_failed", { ...telemetry, error: refreshError, db_role: dbRole });
      return dbRole;
    }

    const { data: refreshedSessionData, error: refreshedSessionError } = await supabase.auth.getSession();
    if (refreshedSessionError) {
      logger.error("auth.role_session_read_after_refresh_failed", {
        ...telemetry,
        error: refreshedSessionError,
      });
      return dbRole;
    }

    const refreshedClaimRole = readRoleFromSessionClaims(refreshedSessionData.session ?? null);
    if (refreshedClaimRole !== dbRole) {
      logger.warn("auth.role_mismatch.after_refresh", {
        ...telemetry,
        refreshed_claim_role: refreshedClaimRole,
        db_role: dbRole,
      });
    }

    return dbRole;
  }

  return dbRole;
};

export function useAuthService({ onLocalAuthStateCleared }: UseAuthServiceOptions = {}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const clearClientAuthState = useCallback(() => {
    onLocalAuthStateCleared?.();
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

  const finalizeAuthAndResolveRole = useCallback(
    async ({ intendedPath }: { intendedPath?: string | null } = {}) => {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        logger.error("auth.finalize.refresh_failed", { error: refreshError });
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        logger.error("auth.finalize.session_fetch_failed", { error });
        return { role: null, session: null, intendedPath: intendedPath ?? null };
      }

      const resolvedRole = await resolveRoleWithClaimsAndDb(data.session ?? null, {
        source: "finalizeAuthAndResolveRole",
        trigger: "manual",
      });

      return {
        role: resolvedRole,
        session: data.session ?? null,
        intendedPath: intendedPath ?? null,
      };
    },
    []
  );

  return {
    signOut,
    clearClientAuthState,
    finalizeAuthAndResolveRole,
  };
}
