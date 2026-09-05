import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { logger } from "@/lib/logger";

export type UserRole = "client" | "coach" | "admin";
export type AuthStatus = "bootstrapping" | "authenticated" | "unauthenticated" | "error";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  loading: boolean;
  status: AuthStatus;
  authStatus: AuthStatus;
  signOut: (options?: SignOutOptions) => Promise<void>;
  refreshRole: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

type SignOutOptions = {
  scope?: "global" | "local";
  redirectTo?: string;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const readRoleFromSession = (session: Session | null): UserRole | null => {
  const r = session?.user?.app_metadata?.role as string | undefined;
  if (r === "client" || r === "coach" || r === "admin") return r;
  return null;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("bootstrapping");
  const queryClient = useQueryClient();

  useEffect(() => {
    let isMounted = true;
    
    // onAuthStateChange fires INITIAL_SESSION on mount with the existing session.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!isMounted) return;
      logger.info("auth.state_change", { event, hasSession: !!currentSession });
      setSession(currentSession ?? null);

      if (event === "SIGNED_OUT") {
        setStatus("unauthenticated");
        queryClient.clear();
      } else if (currentSession) {
        setStatus("authenticated");
      } else if (event === "INITIAL_SESSION") {
        // No stored session
        setStatus("unauthenticated");
      }
    });
    
    // Fallback for getting session on initial load in case onAuthStateChange doesn't fire INITIAL_SESSION correctly with cookie storage
    const bootstrap = async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (isMounted && session) {
                 setSession(session);
                 setStatus("authenticated");
            } else if (isMounted && !session) {
                setStatus(prev => prev === "bootstrapping" ? "unauthenticated" : prev);
            }
        } catch (err) {
            if (isMounted) setStatus("error");
        }
    };
    bootstrap();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const signOut = useCallback(
    async ({ scope = "local", redirectTo = "/" }: SignOutOptions = {}) => {
      try {
        await supabase.auth.signOut({ scope });
      } catch (err) {
        logger.error("signOut error", err);
      } finally {
        queryClient.clear();
        window.location.href = redirectTo;
      }
    },
    [queryClient]
  );
  
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
      setSession(data.session ?? null);
      setStatus(data.session ? "authenticated" : "unauthenticated");
    } catch (error) {
      logger.error("Error refreshing user:", error);
    }
  }, []);

  const user = session?.user ?? null;
  const role = readRoleFromSession(session);
  const loading = status === "bootstrapping";

  return (
    <AuthContext.Provider value={{ user, session, role, loading, status, authStatus: status, signOut, refreshRole, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
