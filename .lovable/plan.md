

# Auth System Rebuild: Simplified & Secure

## Summary

Remove Google OAuth entirely. Rebuild email/password auth with ACID-compliant user creation, eliminate localStorage role caching, and simplify the auth flow to remove race conditions and timeouts.

## Current Problems

1. **localStorage role caching** -- client-side role can be spoofed
2. **Race conditions** -- 12-second timeouts, `authListenerReady` refs, dual initialization paths
3. **800+ line Auth.tsx** -- OAuth callback handling, role dialogs, complex state machine
4. **Non-atomic user creation** -- `handle_new_user` trigger uses nested BEGIN/EXCEPTION blocks that mask partial failures
5. **Google OAuth complexity** -- token sync, refresh logic, localStorage flags (`oauth_provider`, `oauth_role`)

## What Changes

### Database Migration

1. **Replace `handle_new_user` trigger** with a truly atomic version:
   - Single transaction: profile + role + wallet (no nested exception blocks that swallow errors)
   - Set `search_path = public` only (remove `auth`)
   - Keep admin-role protection

2. **Drop `upsert_own_role` function** -- no longer needed since role is set at signup and cannot be changed client-side. If role changes are needed, they go through admin-only operations.

3. **Clean up `user_roles` RLS** -- remove any policy that allows authenticated users to INSERT/UPDATE their own role. Only `service_role` and the trigger can write roles.

### Frontend: `useAuth.tsx` (rewrite)

- Remove localStorage role caching entirely
- Remove `authListenerReady` ref and dual-path initialization
- Simplify to: `onAuthStateChange` listener sets session/user, then fetches role from DB
- Single timeout (5s) for the entire init, no nested timeouts
- Remove `refreshRole` (role is immutable after signup)
- Keep `refreshUser` for profile updates
- Remove token sync setup (no more Google OAuth)

### Frontend: `Auth.tsx` (rewrite ~400 lines instead of 800+)

- Remove all Google OAuth code (button, `startOAuthWithRole`, `handleGoogleAuth`, OAuth callback detection)
- Remove role dialog for OAuth users
- Keep: email/password login, signup with role selection (client/coach), password strength meter, input validation
- Add: password reset flow (forgot password + `/reset-password` page)
- Cleaner state: remove `oauthLoading`, `isFromOAuth`, `showRoleDialog`, `pendingRole`, `submittingRole`

### Frontend: `ProtectedRoute.tsx` (simplify)

- Remove 12-second `roleCheckDelay` timer
- Simple logic: loading? show spinner. No user? redirect to `/auth`. No role? redirect to `/auth`. Wrong role? redirect to their dashboard.
- Single 8-second loading timeout for edge cases

### Frontend: `App.tsx`

- Remove `setupTokenSync` (no OAuth tokens to sync)
- Remove token sync `useEffect`

### Files to Delete

- `src/lib/tokenSync.ts`
- `src/lib/tokenDebug.ts`
- `src/components/TokenManagementDashboard.tsx`
- `src/components/GoogleCalendarStatus.tsx`
- `src/components/GoogleCalendarView.tsx`
- `src/components/AuthDebug.tsx`
- `src/hooks/useGoogleCalendar.ts`
- `src/integrations/google/calendar.ts`

### Files to Update (remove Google Calendar references)

- `src/components/DashboardLayout.tsx` -- remove Google Calendar nav items if present
- `src/config/navigation.tsx` -- remove Google Calendar menu entries
- Any coach pages referencing Google Calendar (Schedule, Sessions, MeetingRoom)

### New File

- `src/pages/ResetPassword.tsx` -- handles password reset after email link click

## Technical Details

**ACID guarantee**: The `handle_new_user` trigger runs inside Postgres's implicit transaction for the INSERT into `auth.users`. If any step (profile, role, wallet) fails, the entire user creation rolls back. No nested exception handlers that catch and re-raise -- a single atomic block.

**Role security**: Roles are set once at signup via the trigger. No client-facing RPC to change roles. Admin role assignment requires direct DB access or a service-role edge function.

**Session management**: Supabase handles session persistence, refresh, and token rotation. The frontend only reads `session.user` and queries `user_roles` table -- no caching, no localStorage.

## Implementation Order

1. Database migration (atomic trigger, lock down role RLS)
2. Rewrite `useAuth.tsx`
3. Rewrite `ProtectedRoute.tsx`
4. Rewrite `Auth.tsx` (email-only, with reset password)
5. Create `ResetPassword.tsx`
6. Update `App.tsx` (remove token sync, add reset-password route)
7. Delete obsolete files (token sync, Google Calendar, debug components)
8. Update remaining components that reference deleted modules

