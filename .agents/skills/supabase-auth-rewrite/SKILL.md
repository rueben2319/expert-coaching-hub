---
name: supabase-auth-rewrite
description: >
  Step-by-step cheatsheet for rewriting the expert-coaching-hub auth and
  authorization layer using canonical Supabase Auth patterns. Use this skill
  whenever working on authentication, session management, role resolution,
  protected routes, or OAuth callback handling in this codebase.
---

# Supabase Auth Rewrite — Expert Coaching Hub

This skill documents the canonical Supabase Auth + React pattern as it applies
to this codebase, the anti-patterns in the current implementation, and the
complete step-by-step rewrite plan.

---

## Core Principles (read before writing any auth code)

1. **JWT carries the role** — Use a Postgres Custom Access Token Hook so the
   user's role (`client`, `coach`, `admin`) is embedded in `app_metadata.role`
   of every access token. Never fetch the role from the DB on the client side.

2. **`onAuthStateChange` is the single source of truth** — Do NOT call both
   `getSession()` and subscribe to `onAuthStateChange`. The `INITIAL_SESSION`
   event fires the subscription on mount with the existing session. One listener,
   one code path.

3. **RLS is the security boundary** — Client-side role checks (ProtectedRoute,
   `allowedRoles`) are UX-only. RLS policies + JWT claims enforced in Postgres
   are the real guard. Never remove RLS policies "because we have ProtectedRoute".

4. **No custom login edge function** — `supabase.auth.signInWithPassword()` is
   called directly from the client. Rate-limiting and account lockout live in
   the `is_login_locked_secure` Postgres RPC, called from a Supabase Auth Hook
   (not an edge function wrapper).

5. **Google token refresh is lazy** — Refresh Google OAuth tokens inside the
   edge function that needs them, right before the Google API call. No polling.

6. **OAuth PKCE is handled by the SDK** — Do not implement custom nonces in
   `sessionStorage`. Supabase's PKCE flow handles code-exchange security.
   `AuthCallback` just waits for `onAuthStateChange` to fire.

---

## Anti-Patterns in the Current Codebase

| File | Anti-pattern | Fix |
|---|---|---|
| `auth-login/index.ts` | Wraps `signInWithPassword` in an edge function | Delete; call SDK directly |
| `oauth-callback/index.ts` | Manually writes role to `app_metadata` post-login | Delete; Custom Access Token Hook does this at issuance |
| `get-user-role/index.ts` | DB role lookup on every bootstrap | Delete; role is in JWT |
| `useAuth.tsx` | Calls `getSession()` AND subscribes to `onAuthStateChange` | Use `onAuthStateChange` only |
| `useAuthService.ts` | `resolveRoleWithClaimsAndDb` — dual network round-trips per bootstrap | Delete; read `session.user.app_metadata.role` |
| `AuthCallback.tsx` | Custom nonce validation in `sessionStorage` | Simplify to just wait for session |
| `lib/oauthCallback.ts` | Nonce creation/storage helpers | Delete |
| `lib/tokenSync.ts` | 60s polling for Google token refresh | Delete; refresh lazily in edge functions |
| `App.tsx` | Calls `setupTokenSync(60000)` on mount | Remove |

---

## Rewrite Plan (execute in order)

### Step 1 — Custom Access Token Hook (DB)

Create a Postgres migration with the hook function. This is the foundation of
the whole rewrite — everything else depends on the role being in the JWT.

```sql
-- supabase/migrations/<timestamp>_custom_access_token_hook.sql

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
  select role into user_role
  from public.user_roles
  where user_id = (event->>'user_id')::uuid;

  claims := event->'claims';

  if jsonb_typeof(claims->'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  end if;

  -- Write role into app_metadata (never user_metadata — user can edit that)
  if user_role is not null then
    claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(user_role));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- Grant required permissions
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
```

Then register it in `supabase/config.toml`:
```toml
[auth.hook.custom_access_token]
enabled = true
uri = "pg-functions://postgres/public/custom_access_token_hook"
```

### Step 2 — Simplify `useAuth.tsx`

Replace the entire file. Key changes:
- Single `onAuthStateChange` listener (catches `INITIAL_SESSION` on mount)
- Remove `latestUpdateToken` ref hack
- Remove `resolveRoleWithClaimsAndDb` call — read role from claims directly
- Remove `AuthStatus` states `"role_missing"` and `"idle"` — not needed anymore
- Keep `"bootstrapping"` → `"authenticated"` / `"unauthenticated"` / `"error"`

```tsx
// src/hooks/useAuth.tsx — canonical pattern
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export type UserRole = "client" | "coach" | "admin";
export type AuthStatus = "bootstrapping" | "authenticated" | "unauthenticated" | "error";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  loading: boolean;
  status: AuthStatus;
  signOut: (options?: { redirectTo?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const readRole = (session: Session | null): UserRole | null => {
  const r = session?.user?.app_metadata?.role as string | undefined;
  return r === "client" || r === "coach" || r === "admin" ? r : null;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("bootstrapping");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession ?? null);
        setStatus(currentSession ? "authenticated" : "unauthenticated");
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async ({ redirectTo = "/" } = {}) => {
    await supabase.auth.signOut({ scope: "local" });
    window.location.href = redirectTo;
  }, []);

  const user = session?.user ?? null;
  const role = readRole(session);
  const loading = status === "bootstrapping";

  return (
    <AuthContext.Provider value={{ user, session, role, loading, status, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

### Step 3 — Simplify `Auth.tsx` (sign-in / sign-up)

**Sign-in:** Replace the `supabase.functions.invoke("auth-login", ...)` call with:
```ts
const { error } = await supabase.auth.signInWithPassword({
  email: normalizedEmail,
  password,
});
if (error) throw error;
// onAuthStateChange will fire; navigate in the useEffect that watches status
```

**Rate limiting:** Move IP lockout to a Supabase Auth Hook (`auth.hook.send_email` or
a `before_sign_in` hook), or keep it as an RLS-backed DB check called from the
client directly via `supabase.rpc("is_login_locked_secure", { p_email, p_ip })`.

**Sign-up:** Keep `supabase.auth.signUp()` as-is. Remove the explicit
`upsert-user-role` edge function call — instead, rely on a Postgres trigger
(`on insert on auth.users`) that creates the `user_roles` row automatically.

```sql
-- Trigger to auto-create user_roles row on new user signup
create or replace function public.handle_new_user_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'role', 'client'))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created_role
  after insert on auth.users
  for each row execute procedure public.handle_new_user_role();
```

After sign-up, the hook fires → JWT contains the role on the very first session.

### Step 4 — Simplify `AuthCallback.tsx`

The Supabase SDK detects the OAuth callback URL and exchanges the code for a
session automatically when `detectSessionInUrl: true` (the default). Just
wait for `onAuthStateChange` to fire:

```tsx
// src/pages/AuthCallback.tsx — canonical pattern
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { resolvePostAuthRoute } from "@/lib/authRouting";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const { status, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "authenticated" && role) {
      navigate(resolvePostAuthRoute(role), { replace: true });
    } else if (status === "unauthenticated") {
      navigate("/auth", { replace: true });
    }
    // "bootstrapping" → keep showing spinner
  }, [status, role, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
```

Delete: `lib/oauthCallback.ts`, the `oauth-callback` edge function.

### Step 5 — Simplify `ProtectedRoute.tsx`

Remove `"role_missing"` status (no longer possible — role is always in JWT when
session exists). Remove `"idle"` status. Simplify to:

```tsx
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { status, role } = useAuth();
  const location = useLocation();

  if (status === "bootstrapping") return <LoadingSpinner />;
  if (status === "unauthenticated") {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to={resolvePostAuthRoute(role)} replace />;
  }
  return <>{children}</>;
}
```

### Step 6 — Delete Obsolete Edge Functions

After the rewrite, these edge functions can be **deleted**:

| Function | Reason |
|---|---|
| `auth-login` | Replaced by direct SDK call + DB rate-limit RPC |
| `oauth-callback` | Replaced by SDK PKCE + Custom Access Token Hook |
| `get-user-role` | Role is now in JWT — never needs a lookup |

Keep (but simplify):
- `upsert-user-role` — still needed for admin role changes; remove the
  `app_metadata` update logic (the hook handles it on next token issue).

### Step 7 — Remove Token Polling

Delete `lib/tokenSync.ts`. In `App.tsx` remove the `setupTokenSync` call.

For Google Calendar, update each edge function that calls the Google API:
```ts
// Pattern: refresh google token lazily at point of use
const tokens = await getStoredGoogleTokens(userId); // from your DB
if (isExpired(tokens)) {
  const refreshed = await refreshGoogleToken(tokens.refresh_token);
  await storeGoogleTokens(userId, refreshed);
}
// proceed with the fresh access token
```

### Step 8 — Google OAuth Callback Scopes

Keep the Google OAuth scopes in `supabase.auth.signInWithOAuth()`:
```ts
scopes: "openid email profile https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly"
```
The Google `access_token` and `refresh_token` are stored by Supabase in
`auth.identities` → retrieve them with `supabase.auth.getSession()` then
`session.provider_token` / `session.provider_refresh_token`.

---

## Files Touched in the Rewrite

```
MODIFY  src/hooks/useAuth.tsx            (simplify — see Step 2)
MODIFY  src/hooks/useAuthService.ts      (remove resolveRoleWithClaimsAndDb; keep signOut helper)
MODIFY  src/pages/Auth.tsx               (remove auth-login invoke — see Step 3)
MODIFY  src/pages/AuthCallback.tsx       (simplify — see Step 4)
MODIFY  src/components/ProtectedRoute.tsx (simplify — see Step 5)
MODIFY  src/App.tsx                      (remove setupTokenSync)

DELETE  src/lib/tokenSync.ts
DELETE  src/lib/oauthCallback.ts
DELETE  supabase/functions/auth-login/
DELETE  supabase/functions/oauth-callback/
DELETE  supabase/functions/get-user-role/

MODIFY  supabase/functions/upsert-user-role/index.ts  (remove app_metadata admin update)
MODIFY  supabase/config.toml             (register custom_access_token hook)

NEW     supabase/migrations/<ts>_custom_access_token_hook.sql
NEW     supabase/migrations/<ts>_handle_new_user_role_trigger.sql
```

---

## Verification Checklist

After completing the rewrite:

- [ ] Fresh signup → `session.user.app_metadata.role` contains the correct role
- [ ] Login → navigates to correct dashboard without calling any edge function for role
- [ ] Google OAuth → completes in `AuthCallback` without nonce errors
- [ ] Logout → clears session, redirects to `/`
- [ ] ProtectedRoute blocks wrong-role access and redirects correctly
- [ ] No 60s polling calls in Network DevTools
- [ ] RLS policies still enforce access on all tables
- [ ] Admin can change a user's role → after sign-out/sign-in the new role is reflected
- [ ] Run `npm test` / vitest — all existing auth tests pass

---

## References

- See `references/canonical-auth-pattern.md` for complete code templates
- [Supabase Auth Hooks docs](https://supabase.com/docs/guides/auth/auth-hooks)
- [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase OAuth with PKCE](https://supabase.com/docs/guides/auth/social-login)
