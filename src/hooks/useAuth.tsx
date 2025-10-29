import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { notifyAuthStateChange } from "@/lib/tokenSync";

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

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.error("Failed to fetch user role:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        console.error("Error details:", error.details);
        setRole(null);
        return;
      }

      if (data) {
        console.log("✅ Successfully fetched role:", data.role);
        setRole(data.role as UserRole);
      } else {
        console.warn("⚠️ No role data found for user:", userId);
        setRole(null);
      }
    } catch (err) {
      console.error("❌ Exception while fetching role:", err);
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
        console.error("Failed to fetch profile data:", error);
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
      console.error("Exception while fetching profile data:", err);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          fetchUserRole(session.user.id);
          fetchUserProfile(session.user.id);
        } else {
          setRole(null);
        }

        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user.id);
        fetchUserProfile(session.user.id);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    navigate("/");
  };

  const refreshRole = async () => {
    if (user?.id) {
      await fetchUserRole(user.id);
    }
  };

  const refreshUser = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      setUser(data.user);
      await fetchUserRole(data.user.id);
      await fetchUserProfile(data.user.id);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signOut, refreshRole, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // This should never happen with our default value, but fallback for safety
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
