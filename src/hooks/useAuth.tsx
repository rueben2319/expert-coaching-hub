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
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const mounted = useRef(true);

  const fetchRole = useCallback(async (userId: string): Promise<UserRole | null> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle()
        .abortSignal(controller.signal);

      clearTimeout(timeout);

      if (error) {
        logger.error("Failed to fetch role:", error.message);
        return null;
      }
      return (data?.role as UserRole) ?? null;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        logger.error("fetchRole timed out after 5s");
      } else {
        logger.error("Exception fetching role:", err);
      }
      return null;
    }
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", userId)
        .single();

      if (data) {
        setUser((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            user_metadata: {
              ...prev.user_metadata,
              full_name: data.full_name ?? prev.user_metadata?.full_name,
              avatar_url: data.avatar_url ?? prev.user_metadata?.avatar_url,
            },
          } as User;
        });
      }
    } catch (err) {
      logger.error("Exception fetching profile:", err);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;

    const safetyTimeout = setTimeout(() => {
      if (mounted.current && loading) {
        logger.warn("Auth loading safety timeout reached");
        setLoading(false);
      }
    }, 8000);

    // Set up auth listener FIRST — but don't set loading=false until getSession resolves
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        logger.log("Auth event:", event);
        if (!mounted.current) return;

        // Skip INITIAL_SESSION from the listener — we handle it via getSession below
        if (event === 'INITIAL_SESSION') return;

        // Handle stale refresh token: if token refresh fires with no session, sign out
        if (event === 'TOKEN_REFRESHED' && !newSession) {
          logger.warn("Token refresh returned null session — signing out");
          setUser(null);
          setSession(null);
          setRole(null);
          setLoading(false);
          return;
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          const userRole = await fetchRole(newSession.user.id);
          if (mounted.current) {
            setRole(userRole);
            fetchProfile(newSession.user.id);
          }
        } else {
          setRole(null);
        }

        if (mounted.current) setLoading(false);
      }
    );

    // Restore session from storage — this is the single source of truth on page load
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      if (!mounted.current) return;
      setSession(existingSession);
      setUser(existingSession?.user ?? null);

      if (existingSession?.user) {
        const userRole = await fetchRole(existingSession.user.id);
        if (mounted.current) {
          setRole(userRole);
          fetchProfile(existingSession.user.id);
        }
      }

      if (mounted.current) setLoading(false);
    }).catch((err) => {
      logger.error("getSession error:", err);
      if (mounted.current) setLoading(false);
    });

    return () => {
      mounted.current = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      logger.error("Error signing out:", error);
    }
    setUser(null);
    setSession(null);
    setRole(null);
    navigate("/");
  }, [navigate]);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser(data.user);
        const userRole = await fetchRole(data.user.id);
        setRole(userRole);
        await fetchProfile(data.user.id);
      }
    } catch (error) {
      logger.error("Error refreshing user:", error);
    }
  }, [fetchRole, fetchProfile]);

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signOut, refreshUser }}>
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
      refreshUser: async () => {},
    };
  }
  return context;
}
