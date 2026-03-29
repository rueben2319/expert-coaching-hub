import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { logger } from "@/lib/logger";

type UserRole = "client" | "coach" | "admin";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>({
  user: null,
  session: null,
  role: null,
  loading: true,
  signOut: async () => {},
  refreshRole: async () => {},
  refreshUser: async () => {},
});

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const initializationAttempted = useRef(false);
  const authListenerReady = useRef(false);

  const fetchUserProfile = async (userId: string) => {
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

      if (data) {
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
  };

  const applyAuthSession = useCallback(
    async (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setRole(getRoleFromSession(nextSession));

      if (nextSession?.user) {
        try {
          await fetchUserProfile(nextSession.user.id);
          logger.log('Profile fetched successfully');
        } catch (err) {
          logger.error('Error fetching user profile in listener:', err);
        }
      }
    },
    []
  );

  const refreshRole = useCallback(async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      logger.error("Failed to refresh signed claims:", error);
      setRole(null);
      return;
    }
    await applyAuthSession(data.session ?? null);
  }, [applyAuthSession]);

  useEffect(() => {
    if (initializationAttempted.current) {
      logger.log('Auth initialization already attempted, skipping...');
      return;
    }

    initializationAttempted.current = true;
    let isMounted = true;

    logger.log('Setting up auth state listener...');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        logger.log('Auth state changed:', event);
        authListenerReady.current = true;

        if (!isMounted) return;

        let sessionToApply = currentSession ?? null;
        if (event === "USER_UPDATED") {
          const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            logger.error("Failed to refresh claims after USER_UPDATED event:", refreshError);
          } else {
            sessionToApply = refreshedData.session ?? sessionToApply;
          }
        }
        await applyAuthSession(sessionToApply);

        logger.log('Auth listener fired, clearing loading state');
        setLoading(false);
      }
    );

    const initializeAuth = async () => {
      logger.log('Starting auth initialization...');

      const maxWaitTimeout = setTimeout(() => {
        if (isMounted && loading) {
          logger.info('Max wait timeout reached, clearing loading state');
          setLoading(false);
        }
      }, 12000);

      try {
        const getSessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('getSession timeout')), 5000);
        });

        logger.log('Attempting to get session...');
        const result = await Promise.race([getSessionPromise, timeoutPromise]);

        clearTimeout(maxWaitTimeout);

        if (!isMounted) {
          logger.log('Component unmounted during session fetch');
          return;
        }

        const currentSession = result?.data?.session || null;
        logger.log('Session retrieved successfully:', currentSession ? `User: ${currentSession.user.email}` : 'No session');

        if (!authListenerReady.current) {
          await applyAuthSession(currentSession);
        }

        if (isMounted && !authListenerReady.current) {
          logger.log('Initialization complete via getSession, clearing loading state');
          setLoading(false);
        }
      } catch (error: any) {
        clearTimeout(maxWaitTimeout);
        if (error?.message === 'getSession timeout') {
          logger.log('getSession timed out, relying on auth listener');
        } else {
          logger.error('Error during getSession:', error);
        }

        logger.log('Relying on auth listener to set state');
      }
    };

    initializeAuth();

    return () => {
      logger.log('Cleaning up auth provider');
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [applyAuthSession, loading]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setRole(null);
      navigate("/");
    } catch (error) {
      logger.error('Error signing out:', error);
      setUser(null);
      setSession(null);
      setRole(null);
      navigate("/");
    }
  };

  const refreshUser = useCallback(async () => {
    try {
      const [{ data }, { data: sessionData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);

      if (data.user) {
        setUser(data.user);
        setRole(getRoleFromSession(sessionData.session ?? null));
        await fetchUserProfile(data.user.id);
      }
    } catch (error) {
      logger.error('Error refreshing user:', error);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signOut, refreshRole, refreshUser }}>
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
      signOut: async () => {},
      refreshRole: async () => {},
      refreshUser: async () => {},
    };
  }
  return context;
}
