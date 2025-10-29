import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { notifyAuthStateChange } from "@/lib/tokenSync";
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const initializationAttempted = useRef(false);
  const isInitializing = useRef(false);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        logger.error("Failed to fetch user role:", { error, code: error.code, message: error.message });
        setRole(null);
        return;
      }

      if (data) {
        logger.log("Successfully fetched role:", data.role);
        setRole(data.role as UserRole);
      } else {
        logger.warn("No role found for user:", userId);
        setRole(null);
      }
    } catch (err) {
      logger.error("Exception while fetching role:", err);
      setRole(null);
    }
  };

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

  // Helper function to get session with retry logic
  const getSessionWithRetry = async (maxRetries = 2, timeoutMs = 10000): Promise<Session | null> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.log(`Attempting to get session (attempt ${attempt}/${maxRetries})...`);
        
        // Create an abort controller for this attempt
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        try {
          const { data, error } = await supabase.auth.getSession();
          clearTimeout(timeoutId);
          
          if (error) {
            logger.error(`Session retrieval error on attempt ${attempt}:`, error);
            if (attempt === maxRetries) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
            continue;
          }
          
          return data.session;
        } catch (err: any) {
          clearTimeout(timeoutId);
          if (err.name === 'AbortError' || err.message?.includes('aborted')) {
            logger.warn(`Session request timed out on attempt ${attempt}`);
            if (attempt === maxRetries) {
              throw new Error(`getSession timed out after ${maxRetries} attempts`);
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          throw err;
        }
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        logger.warn(`Retry ${attempt} failed, trying again...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    return null;
  };

  useEffect(() => {
    // Prevent double initialization in React strict mode
    if (initializationAttempted.current || isInitializing.current) {
      logger.log('Auth initialization already attempted or in progress, skipping...');
      return;
    }
    
    isInitializing.current = true;
    let isMounted = true;

    // Initialize auth state from current session
    const initializeAuth = async () => {
      logger.log('Starting auth initialization...');
      
      try {
        // First, check if we have a session in localStorage to avoid unnecessary calls
        const localStorageKey = `sb-${supabase.auth.getSession ? new URL((supabase as any).supabaseUrl).hostname.split('.')[0] : 'unknown'}-auth-token`;
        const hasLocalSession = localStorage.getItem(localStorageKey);
        
        if (!hasLocalSession) {
          logger.log('No local session found in localStorage');
          setSession(null);
          setUser(null);
          setRole(null);
          setLoading(false);
          return;
        }

        logger.log('Local session detected, fetching from Supabase...');
        const session = await getSessionWithRetry();
        
        if (!isMounted) {
          logger.log('Component unmounted, skipping initialization');
          return;
        }
        
        logger.log('Session retrieved:', session ? `User: ${session.user.email}` : 'No session');
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          logger.log('Fetching role and profile for user:', session.user.id);
          await Promise.all([
            fetchUserRole(session.user.id),
            fetchUserProfile(session.user.id)
          ]);
        } else {
          logger.log('No user session, setting role to null');
          setRole(null);
        }
      } catch (error: any) {
        logger.error('Error initializing auth:', error);
        
        // Clear potentially corrupted auth data
        if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
          logger.warn('Clearing potentially corrupted auth data from localStorage');
          try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
              if (key.startsWith('sb-') && key.includes('-auth-token')) {
                localStorage.removeItem(key);
                logger.log('Removed:', key);
              }
            });
          } catch (e) {
            logger.error('Failed to clear localStorage:', e);
          }
        }
        
        setSession(null);
        setUser(null);
        setRole(null);
      } finally {
        if (isMounted) {
          logger.log('Setting loading to false');
          setLoading(false);
          isInitializing.current = false;
        }
      }
    };

    // Set up listener for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.log('Auth state changed:', event);
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await Promise.all([
            fetchUserRole(session.user.id),
            fetchUserProfile(session.user.id)
          ]);
        } else {
          setRole(null);
        }
      }
    );

    // Initialize on mount
    initializeAuth();
    initializationAttempted.current = true;

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    navigate("/");
  };

  const refreshRole = useCallback(async () => {
    if (user?.id) {
      await fetchUserRole(user.id);
    }
  }, [user?.id]);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser(data.user);
        await Promise.all([
          fetchUserRole(data.user.id),
          fetchUserProfile(data.user.id)
        ]);
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