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
  const authListenerReady = useRef(false);

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

  useEffect(() => {
    // Prevent double initialization in React strict mode
    if (initializationAttempted.current) {
      logger.log('Auth initialization already attempted, skipping...');
      return;
    }
    
    initializationAttempted.current = true;
    let isMounted = true;

    // Set up listener for auth state changes FIRST - this is our primary source of truth
    logger.log('Setting up auth state listener...');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.log('Auth state changed:', event);
        authListenerReady.current = true;
        
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Fetch role and profile with timeout to prevent hanging
          try {
            const fetchPromise = Promise.all([
              fetchUserRole(session.user.id),
              fetchUserProfile(session.user.id)
            ]);
            
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Role fetch timeout')), 12000)
            );
            
            await Promise.race([fetchPromise, timeoutPromise]);
            logger.log('Role and profile fetched successfully');
          } catch (err: any) {
            if (err?.message === 'Role fetch timeout') {
              logger.info('Role fetch timed out; will rely on next auth event');
            } else {
              logger.error('Error fetching user data in listener:', err);
            }
            // Do not forcibly clear role on transient timeout; allow next auth events to resolve
          }
        } else {
          setRole(null);
        }

        // Clear loading state after role fetch attempt (success or failure)
        logger.log('Auth listener fired, clearing loading state');
        setLoading(false);
      }
    );

    // Initialize auth state
    const initializeAuth = async () => {
      logger.log('Starting auth initialization...');
      
      // Set a maximum wait time - if nothing happens in 12 seconds, clear loading anyway
      const maxWaitTimeout = setTimeout(() => {
        if (isMounted && loading) {
          logger.info('Max wait timeout reached, clearing loading state');
          setLoading(false);
        }
      }, 12000);

      try {
        // Try to get session with a short timeout
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

        const session = result?.data?.session || null;
        logger.log('Session retrieved successfully:', session ? `User: ${session.user.email}` : 'No session');
        
        // Only update state if the auth listener hasn't already done so
        if (!authListenerReady.current) {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            logger.log('Fetching role and profile for user:', session.user.id);
            await Promise.all([
              fetchUserRole(session.user.id),
              fetchUserProfile(session.user.id)
            ]).catch(err => {
              logger.error('Error fetching user data:', err);
            });
          } else {
            setRole(null);
          }
        }

        // Clear loading state
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

        // Don't clear loading here - let the auth listener or max timeout handle it
        // The listener will fire eventually and set the correct state
        logger.log('Relying on auth listener to set state');
      }
    };

    // Start initialization but don't block on it
    initializeAuth();

    return () => {
      logger.log('Cleaning up auth provider');
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setRole(null);
      navigate("/");
    } catch (error) {
      logger.error('Error signing out:', error);
      // Force clear state even if signOut fails
      setUser(null);
      setSession(null);
      setRole(null);
      navigate("/");
    }
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