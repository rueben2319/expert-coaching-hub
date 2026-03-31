

# Full Codebase Audit Report

## Current State

The auth rebuild is complete and working. Here are the remaining issues found across the codebase:

## Issues Found

### 1. Missing Routes in App.tsx (HIGH)
Three pages exist but have no routes defined:
- `src/pages/client/CreditPackages.tsx` -- no route (referenced by `CreditWallet.tsx` as `/client/credits`)
- `src/pages/client/CreditPurchaseSuccess.tsx` -- no route
- `src/pages/client/SessionDetails.tsx` -- no route

**Fix**: Add lazy imports and routes for these three pages.

### 2. Stale Refresh Token (HIGH)
Auth logs show `"Invalid Refresh Token: Refresh Token Not Found"`. This happens when the browser has an old session token that Supabase no longer recognizes. The current `useAuth.tsx` handles `getSession()` errors but doesn't explicitly clear stale sessions when a token refresh fails.

**Fix**: Add a `TOKEN_REFRESHED` error handler in `onAuthStateChange` -- if the session becomes null after a refresh failure, clear state and redirect to `/auth`.

### 3. Unused `initialSessionResolved` Variable (LOW)
In `useAuth.tsx` line 75, `initialSessionResolved` is set but never read.

**Fix**: Remove it.

### 4. Raw `console.log/error/warn` Calls (MEDIUM)
656 instances across 30 files use raw `console.*` instead of the `logger` utility. In production, these leak debug info.

**Fix**: Replace `console.log/warn` with `logger.log/warn` in key files: `Billing.tsx`, `VideoContent.tsx`, `supabaseFunctions.ts`, `CreateSession.tsx`. Keep `console.error` only where `logger.error` isn't imported.

### 5. `CreditWallet.tsx` Links to Wrong Route (MEDIUM)
Navigates to `/client/credits` but the page file is `CreditPackages.tsx`. Route must match.

**Fix**: Add route `/client/credits` pointing to `CreditPackages` component.

### 6. `supabaseFunctions.ts` Still Has Raw Console Logs (LOW)
Uses `console.error` and `console.log` directly instead of the `logger` utility, including logging partial auth tokens.

**Fix**: Replace with `logger` calls, remove token presence logging.

### 7. Duplicate RLS Policies on Several Tables (LOW)
`credit_wallets` has duplicate SELECT and UPDATE policies; `client_notes` has duplicate CRUD policies; `profiles` has duplicate SELECT and INSERT policies. These are functionally harmless but add confusion.

**Fix**: Database migration to drop the redundant older policies.

## Implementation Plan

### Step 1: Add missing routes to App.tsx
- Add lazy imports for `CreditPackages`, `CreditPurchaseSuccess`, `SessionDetails`
- Add three client routes: `/client/credits`, `/client/credits/success`, `/client/session/:meetingId`

### Step 2: Fix stale refresh token handling in useAuth.tsx
- Remove unused `initialSessionResolved` variable
- In `onAuthStateChange`, handle case where `TOKEN_REFRESHED` fires with null session (sign out gracefully)

### Step 3: Replace raw console.* with logger in key files
- `src/lib/supabaseFunctions.ts` -- replace all console.* with logger, remove token logging
- `src/pages/coach/Billing.tsx` -- replace console.* with logger
- `src/pages/coach/CreateSession.tsx` -- replace console.error with logger.error
- `src/components/content/VideoContent.tsx` -- replace console.* with logger

### Step 4: Database migration to clean duplicate RLS policies
- Drop duplicate policies on `credit_wallets`, `client_notes`, `profiles`

## Technical Details

The auth logs show the refresh token error originates from the preview URL. This is expected when sessions expire or are invalidated server-side. The fix ensures the frontend gracefully handles this instead of showing a blank loading state.

The missing routes are the most impactful issue -- users clicking "Buy Credits" from the wallet component get a 404.

