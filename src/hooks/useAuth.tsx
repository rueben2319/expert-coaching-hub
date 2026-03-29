import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { AuthSignOutOptions, resolveRoleWithClaimsAndDb, useAuthService, UserRole } from "@/hooks/useAuthService";

export type AuthStatus =
  | "idle"
  | "bootstrapping"
  | "authenticated"
  | "unauthenticated"
  | "role_missing"
  | "error";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  loading: boolean;
  authStatus: AuthStatus;
  status: AuthStatus;
  signOut: (options?: AuthSignOutOptions) => Promise<void>;
  refreshRole: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getStatusFromSession = (session: Session | null, nextRole: UserRole | null): AuthStatus => {
  if (!session?.user) {
    return "unauthenticated";
  }

  if (!nextRole) {
    return "role_missing";
  }

  return "authenticated";
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [status, setStatus] = useState<AuthStatus>("idle");
  const latestUpdateToken = useRef(0);

  const { signOut } = useAuthService({
    onLocalAuthStateCleared: () => {
      latestUpdateToken.current += 1;
      setUser(null);
      setSession(null);
      setRole(null);
      setStatus("unauthenticated");
    },
  });

  const fetchUserProfile = useCallback(async (userId: string, updateToken: number) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", userId)
        .single();

      if (error) {
        logger.error("Failed to fetch profile data:", error);
        return;
      }

      if (data && updateToken === latestUpdateToken.current) {
        setUser((currentUser) => {
          if (!currentUser) return currentUser;

          return {
            ...currentUser,
            user_metadata: {
              ...currentUser.user_metadata,
              full_name: data.full_name ?? currentUser.user_metadata?.full_name,
              avatar_url: data.avatar_url ?? currentUser.user_metadata?.avatar_url,
            },
          } as User;
        });
      }
    } catch (err) {
      logger.error("Exception while fetching profile data:", err);
    }
  }, []);

  const applyAuthSession = useCallback(
    async (nextSession: Session | null, updateToken: number, trigger: "bootstrap" | "auth_state_change" = "auth_state_change") => {
      if (updateToken < latestUpdateToken.current) {
        return;
      }

      latestUpdateToken.current = updateToken;
      const nextUser = nextSession?.user ?? null;
      const nextRole = nextUser
        ? await resolveRoleWithClaimsAndDb(nextSession, {
            source: "useAuth",
            trigger,
          })
        : null;

      if (nextUser && !nextRole) {
        logger.warn("auth.role_mismatch.client_vs_db", {
          user_id: nextUser.id,
          claim_role: nextSession?.user?.app_metadata?.role ?? null,
          db_role: null,
          resolved_role: nextRole,
          trigger,
        });
      }

      setSession(nextSession);
      setUser(nextUser);
      setRole(nextRole);
      setStatus(getStatusFromSession(nextSession, nextRole));

      if (nextUser) {
        await fetchUserProfile(nextUser.id, updateToken);
      }
    },
    [fetchUserProfile]
  );

  useEffect(() => {
    let isMounted = true;

    setStatus("bootstrapping");

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        if (!isMounted) return;

        const updateToken = latestUpdateToken.current + 1;
        await applyAuthSession(currentSession ?? null, updateToken, "auth_state_change");
      }
    );

    const initializeAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (error) {
          logger.error("Error during getSession bootstrap:", error);
          setStatus("error");
          return;
        }

        const updateToken = latestUpdateToken.current + 1;
        await applyAuthSession(data.session ?? null, updateToken, "bootstrap");
      } catch (error) {
        logger.error("Unhandled bootstrap error:", error);
        if (isMounted) {
          setStatus("error");
        }
      }
    };

    void initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [applyAuthSession]);

  const refreshRole = useCallback(async () => {
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      logger.error("Failed to refresh signed claims:", error);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        logger.error("Error refreshing user session:", error);
        return;
      }

      const updateToken = latestUpdateToken.current + 1;
      await applyAuthSession(data.session ?? null, updateToken, "auth_state_change");
    } catch (error) {
      logger.error("Error refreshing user:", error);
    }
  }, [applyAuthSession]);

  const loading = status === "idle" || status === "bootstrapping";

  return (
    <AuthContext.Provider
      value={{ user, session, role, loading, authStatus: status, status, signOut, refreshRole, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    return {
      user: null,
      session: null,
      role: null,
      loading: true,
      authStatus: "idle" as AuthStatus,
      status: "idle" as AuthStatus,
      signOut: async () => {},
      refreshRole: async () => {},
      refreshUser: async () => {},
    };
  }
  return context;
}
