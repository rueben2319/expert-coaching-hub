# Canonical Auth Pattern — Code Reference Templates

These are drop-in reference templates for the expert-coaching-hub auth rewrite.
All files below are **complete replacements** for their current counterparts.

---

## 1. Postgres Custom Access Token Hook

**File:** `supabase/migrations/<timestamp>_custom_access_token_hook.sql`

```sql
-- Custom Access Token Hook
-- Embeds the user's application role into every JWT at issuance time.
-- This eliminates the need for any client-side DB role lookup.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  claims jsonb;
  user_role text;
begin
  -- Read role from user_roles table
  select role into user_role
  from public.user_roles
  where user_id = (event->>'user_id')::uuid;

  claims := event->'claims';

  -- Ensure app_metadata key exists
  if jsonb_typeof(claims->'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  end if;

  -- Inject role (null-safe: skip injection if no role found)
  if user_role is not null then
    claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(user_role));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- Required permission grants
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;

-- Revoke from everyone else for security
revoke execute on function public.custom_access_token_hook
  from authenticated, anon, public;
```

---

## 2. New User Role Trigger

**File:** `supabase/migrations/<timestamp>_handle_new_user_role_trigger.sql`

```sql
-- Automatically creates a user_roles row when a new user signs up.
-- The role is taken from user_metadata.role (set during supabase.auth.signUp),
-- defaulting to 'client' if not provided.

create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
begin
  -- Only allow valid roles; default to 'client'
  requested_role := new.raw_user_meta_data->>'role';
  if requested_role not in ('client', 'coach') then
    requested_role := 'client';
  end if;

  insert into public.user_roles (user_id, role)
  values (new.id, requested_role)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Drop trigger if exists (idempotent migration)
drop trigger if exists on_auth_user_created_role on auth.users;

create trigger on_auth_user_created_role
  after insert on auth.users
  for each row execute procedure public.handle_new_user_role();
```

---

## 3. `supabase/config.toml` — Register Auth Hook

Add under the `[auth]` section:

```toml
[auth.hook.custom_access_token]
enabled = true
uri = "pg-functions://postgres/public/custom_access_token_hook"
```

---

## 4. `src/hooks/useAuth.tsx` — Simplified

```tsx
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
  signOut: (options?: SignOutOptions) => Promise<void>;
}

type SignOutOptions = {
  scope?: "global" | "local";
  redirectTo?: string;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Reads the application role from JWT app_metadata.
 * Role is embedded by the Custom Access Token Hook — no DB call needed.
 */
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
    // onAuthStateChange fires INITIAL_SESSION on mount with the existing session.
    // No need to call getSession() separately.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
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

    return () => subscription.unsubscribe();
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

  const user = session?.user ?? null;
  const role = readRoleFromSession(session);
  const loading = status === "bootstrapping";

  return (
    <AuthContext.Provider value={{ user, session, role, loading, status, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
```

---

## 5. `src/pages/Auth.tsx` — Sign-in / Sign-up (key changes only)

Replace the `handleAuth` function's login branch:

```tsx
// BEFORE (calls edge function):
const { data, error } = await supabase.functions.invoke("auth-login", {
  body: { email: normalizedEmail, password },
});

// AFTER (direct SDK call):
const { error } = await supabase.auth.signInWithPassword({
  email: normalizedEmail,
  password,
});
if (error) throw error;
// Navigation is handled by the useEffect that watches status + role
```

For sign-up, keep `supabase.auth.signUp()` as-is but **remove** the
`upsert-user-role` edge function call — the DB trigger handles it:

```tsx
const { error } = await supabase.auth.signUp({
  email: email.trim().toLowerCase(),
  password,
  options: {
    data: {
      full_name: sanitizedFullName,
      role: selectedRole, // trigger reads this from raw_user_meta_data
    },
  },
});
if (error) throw error;
// onAuthStateChange fires SIGNED_IN; useEffect navigates to dashboard
toast.success("Account created! Please check your email to confirm.");
```

Remove the `useAuthService` import and all uses of `finalizeAuthAndResolveRole`.

---

## 6. `src/pages/AuthCallback.tsx` — Simplified

```tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { resolvePostAuthRoute } from "@/lib/authRouting";
import { Loader2, ShieldAlert } from "lucide-react";

/**
 * OAuth callback page.
 *
 * The Supabase SDK detects the OAuth code/token in the URL and exchanges it
 * for a session automatically (PKCE flow, detectSessionInUrl: true by default).
 * We simply wait for onAuthStateChange to update status and then navigate.
 *
 * No custom nonce, no edge function call needed.
 */
export default function AuthCallback() {
  const { status, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "authenticated" && role) {
      navigate(resolvePostAuthRoute(role), { replace: true });
    } else if (status === "unauthenticated") {
      navigate("/auth?error=oauth_failed", { replace: true });
    }
    // "bootstrapping" → keep showing spinner
  }, [status, role, navigate]);

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-destructive">
          <ShieldAlert className="h-5 w-5" />
          <p>Sign-in failed. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
```

---

## 7. `src/components/ProtectedRoute.tsx` — Simplified

```tsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { resolvePostAuthRoute } from "@/lib/authRouting";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<"client" | "coach" | "admin">;
}

/**
 * Guards routes by authentication status and optional role.
 *
 * Security note: This is a UX guard only. Real security is enforced by
 * Postgres RLS policies that check auth.uid() and auth.jwt() claims.
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { status, role } = useAuth();
  const location = useLocation();

  if (status === "bootstrapping") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <Navigate
        to="/auth"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to={resolvePostAuthRoute(role)} replace />;
  }

  return <>{children}</>;
}
```

---

## 8. Simplified `upsert-user-role` Edge Function

Remove the `admin.auth.admin.updateUserById` call that backfills metadata.
Role changes in `user_roles` table are picked up by the Custom Access Token
Hook on the next token refresh automatically.

```ts
// Keep only:
// 1. Authenticate caller (Bearer JWT)
// 2. Call secure_upsert_user_role RPC
// 3. Return success
//
// REMOVE: any supabase.auth.admin.updateUserById() call
// REMOVE: any app_metadata / user_metadata update logic
```

---

## 9. Google OAuth Token Access

After OAuth sign-in, access Google tokens from the session (no polling needed):

```ts
// In any edge function that calls Google APIs:
const { data: { session } } = await supabase.auth.getSession();

// provider_token = Google access token (short-lived)
// provider_refresh_token = Google refresh token (long-lived)
const googleAccessToken = session?.provider_token;
const googleRefreshToken = session?.provider_refresh_token;

if (!googleAccessToken) {
  // Token expired — refresh via Google token endpoint
  const refreshed = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: googleRefreshToken,
      grant_type: "refresh_token",
    }),
  }).then(r => r.json());
  // Store refreshed.access_token in your DB for the user
}
```

---

## Key Decisions Recorded

| Decision | Choice | Rationale |
|---|---|---|
| Rate limiting | Keep `is_login_locked_secure` DB RPC, call from client | Avoids edge function hop; still server-enforced |
| Google token refresh | Lazy refresh in each edge function | No polling overhead; refresh only when actually needed |
| `user_metadata.role` | Can be removed after hook is live | `app_metadata.role` is the authoritative source |
| OAuth nonce | Removed | SDK PKCE handles this natively |
