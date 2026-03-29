import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { AuthSignOutOptions, useAuthService } from "@/hooks/useAuthService";

export type UserRole = "client" | "coach" | "admin";
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
  status: AuthStatus;
  signOut: (options?: AuthSignOutOptions) => Promise<void>;
  refreshRole: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isUserRole = (value: unknown): value is UserRole =>
  value === "client" || value === "coach" || value === "admin";

const readRoleFromAccessToken = (session: Session | null): UserRole | null => {
  const accessToken = session?.access_token;
  if (!accessToken) return null;

  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return null;

    const normalizedBase64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    if (typeof window === "undefined") return null;
    const decodedPayload = window.atob(normalizedBase64);
    const parsed = JSON.parse(decodedPayload) as { role?: unknown };

    return isUserRole(parsed.role) ? parsed.role : null;
  } catch {
    return null;
  }
};

const getRoleFromSession = (session: Session | null): UserRole | null => {
  const roleFromSignedClaim = readRoleFromAccessToken(session);
  const role = roleFromSignedClaim ?? (session?.user?.app_metadata?.role as string | undefined) ?? null;

  if (isUserRole(role)) {
    return role;
  }

  return null;
};

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
    async (nextSession: Session | null, updateToken: number) => {
      if (updateToken < latestUpdateToken.current) {
        return;
      }

      latestUpdateToken.current = updateToken;
      const nextUser = nextSession?.user ?? null;
      const nextRole = getRoleFromSession(nextSession);

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
        await applyAuthSession(currentSession ?? null, updateToken);
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
        await applyAuthSession(data.session ?? null, updateToken);
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
      await applyAuthSession(data.session ?? null, updateToken);
    } catch (error) {
      logger.error("Error refreshing user:", error);
    }
  }, [applyAuthSession]);

  const loading = status === "idle" || status === "bootstrapping";

  return (
    <AuthContext.Provider value={{ user, session, role, loading, status, signOut, refreshRole, refreshUser }}>
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
      status: "idle" as AuthStatus,
      signOut: async () => {},
      refreshRole: async () => {},
      refreshUser: async () => {},
    };
  }
  return context;
}
