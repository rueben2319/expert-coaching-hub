# 🧩 DEBUG REPORT

## Overview
Vite React app runs on port 8080. Major issues are hardcoded Supabase credentials in the frontend, inconsistent Google OAuth/Calendar token handling between client and Edge Functions, and a transactions schema mismatch for payments. Several env variables are missing/unused. SPA redirects for Netlify are present.

---

## 1. Environment & Setup
- 🔴 Missing env usage in frontend; credentials hardcoded:
  - /src/integrations/supabase/client.ts
  - /src/lib/supabaseFunctions.ts
  - /src/lib/meetingUtils.ts
  - Fix: Use import.meta.env vars and .env files instead of literals.
- 🟠 Dev proxy mismatch fixed: server runs at 8080 but proxy targeted 3000. Port updated to 8080.
- 🟠 Missing deployment configs (optional): netlify.toml/vercel.json, Dockerfile.
- Required env vars:
  - Frontend (.env):
    - VITE_SUPABASE_URL
    - VITE_SUPABASE_ANON_KEY
    - VITE_APP_BASE_URL (used for redirects if needed)
  - Supabase Edge Functions (Project Settings > Functions env):
    - SUPABASE_URL
    - SUPABASE_SERVICE_ROLE_KEY
    - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
    - PAYCHANGU_SECRET_KEY, PAYCHANGU_WEBHOOK_SECRET, PAYCHANGU_DEFAULT_CURRENCY (e.g. MWK)
    - APP_BASE_URL (https://your-app-domain)

---

## 2. Frontend (React + Tailwind)
### 🔴 Critical Issues
- Hardcoded Supabase URL/key
  - Root Cause: Credentials embedded in code; cannot vary per environment and are exposed to clients and VCS.
  - Fix:
    ```ts
    // src/integrations/supabase/client.ts
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
    const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    ```
    ```ts
    // src/lib/supabaseFunctions.ts
    const functionUrl = `${supabase.storageUrl?.replace('/storage/v1','') || import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;
    const apikey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    ```
    ```ts
    // src/lib/meetingUtils.ts
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    ```
  - Files: /src/integrations/supabase/client.ts, /src/lib/supabaseFunctions.ts, /src/lib/meetingUtils.ts

- Inconsistent meeting cancel flow (bypasses Edge Function)
  - Root Cause: MeetingManager.cancelMeeting calls Google API directly; token/permissions may fail; duplicates logic.
  - Fix: Route through the existing cancel-google-meet Edge Function via callSupabaseFunction.
  - File: /src/lib/meetingUtils.ts

### 🟠 Major Issues
- Supabase function invocation uses hardcoded project URL and apikey
  - Root Cause: /src/lib/supabaseFunctions.ts builds URLs with literals.
  - Fix: Use supabase.functions.invoke or derive base from env/client as above; keep Authorization bearer from session.

- Google Calendar client service relies on session.provider_token only
  - Root Cause: provider_token may be absent after session restoration; refresh handling is missing client-side.
  - Fix: Prefer Edge Functions for Calendar operations (create/update/delete) where refresh is implemented; keep client read-only or add token refresh flow.
  - File: /src/integrations/google/calendar.ts

### 🟢 Minor Improvements
- TokenDebugger.testCalendarAccess uses tokenPreview (truncated) and will always fail; restrict to console utilities or remove in production.
  - File: /src/lib/tokenDebug.ts
- Remove unused App.css (Vite starter styles) if no longer needed.
- Add Suspense/React Query error boundaries for better UX.

---

## 3. Backend (Supabase)
### 🔴 Critical
- create-google-meet does not forward the user Authorization to getSession
  - Root Cause: Client is created without global Authorization header; supabase.auth.getSession() won’t have user context; provider tokens unavailable.
  - Fix:
    ```ts
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(url, serviceKey, { global: { headers: { Authorization: authHeader! } } });
    // then use OAuthTokenManager/getValidatedGoogleToken like the other functions
    ```
  - File: /supabase/functions/create-google-meet/index.ts

- Transactions schema mismatch (client_subscription_id)
  - Root Cause: create-payment-link writes transactions.client_subscription_id; types and webhook expect it, but the Database schema in /src/integrations/supabase/types.ts has no such column.
  - Fix options:
    1) DB: Add client_subscription_id UUID nullable column to transactions with FK to client_subscriptions(id) and update types.
    2) Or reuse transactions.subscription_id for both and infer type by presence in coach_subscriptions vs client_subscriptions.
  - Files: /supabase/functions/create-payment-link/index.ts, /supabase/functions/paychangu-webhook/index.ts, /src/integrations/supabase/types.ts

### 🟠 Major
- Mixed token handling across functions
  - Root Cause: create-google-meet hand-rolls token refresh; others use OAuthTokenManager.
  - Fix: Standardize to OAuthTokenManager + TokenStorage in all functions.

- Excessive sensitive logging in Edge Functions
  - Root Cause: create-payment-link logs raw request bodies and secret prefixes.
  - Fix: Remove raw body dumps; mask PII; never log secrets (even prefixes) in production.

- Potential RLS gaps
  - Root Cause: Frontend queries rely on user_id filters (e.g., client_subscriptions, meetings). Ensure RLS policies exist for each table to enforce auth.uid() matches owner columns.
  - Fix: Verify/create RLS policies and enable RLS on all user data tables.

### 🟢 Minor
- Standardize CORS headers to include methods used by each endpoint; already mostly present.
- Add typed request body zod validation for functions for clearer errors.

---

## 4. Integrations
### Google Calendar & Meet
- Issues:
  - Client-only access using provider_token may fail after session restore; no refresh.
  - create-google-meet lacks Authorization forwarding and shared token manager usage.
- Fix:
  - Route all create/update/delete through Edge Functions using getValidatedGoogleToken and OAuthTokenManager.
  - Ensure scopes: calendar.events, calendar.readonly; use access_type=offline and prompt=consent (already present in Auth and Status components).
  - Store refreshed tokens via TokenStorage in metadata; consider TOKEN_STORAGE_STRATEGY=database when needed.

### Google OAuth
- Verify Supabase Auth provider is configured with Google credentials and redirect URLs (APP_BASE_URL/auth and APP_BASE_URL/* if using Netlify/Vercel).
- Ensure GOOGLE_CLIENT_ID/SECRET are set for Edge Functions; without them, refresh flow fails.

### PayChangu Payment Gateway
- Schema mismatch for transactions as noted.
- Webhook signature validation may differ from provider’s spec; confirm header name and algorithm per PayChangu docs and update verifySignature accordingly.
- Ensure PAYCHANGU_WEBHOOK_SECRET is set; otherwise verification is skipped.
- Use 302 redirects with APP_BASE_URL on success (already implemented); verify both client and coach success pages exist.
- Add retry/Idempotency: guard against duplicate webhooks by checking existing transaction status before updates.

---

## 5. Deployment (Docker, Netlify/Vercel)
- Netlify SPA redirects present via public/_redirects (/* 200). Good.
- Add netlify.toml or vercel.json to declare build command (vite build), output (dist), and env mappings as needed.
- Provide Dockerfile for local containerized builds if Docker is a target; otherwise omit.
- Ensure environment vars are set in hosting provider and Supabase Functions environment.

---

## ✅ Recommendations
- Move all secrets/URLs to env; commit an .env.example with required keys.
- Consolidate Google Calendar logic into Edge Functions; keep client as thin wrapper.
- Fix transactions schema mismatch and regenerate Supabase types to match DB.
- Add error boundaries and loading states across routes; ensure role-based redirects are tested.
- Reduce function logging; prefer structured logs without PII/secrets.
- Add integration tests for payment flows and calendar flows using mocked HTTP.

---

## 📊 Health Summary
| Category | Status | Notes |
|-----------|---------|-------|
| Frontend | 🟠 | Hardcoded Supabase creds; improve function invocation and meeting cancel flow |
| Backend | 🟠 | create-google-meet auth context; logging; standardize token manager |
| OAuth & Google APIs | 🟠 | Ensure refresh in all paths; centralize via Edge Functions |
| Payments | 🔴 | Transactions schema mismatch; update DB or code |
| Deployment | 🟡 | SPA redirects OK; add provider config files and envs |
