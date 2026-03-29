# Supabase Credential Leak Response Runbook

Use this checklist immediately when an API key, secret, or JWT is exposed.

## 1) Rotate exposed API keys/secrets

1. Open **Supabase Dashboard → Project Settings → API**.
2. Rotate/reveal and replace any leaked values:
   - `anon` key
   - `service_role` key
   - legacy JWT secret (if enabled in your project)
3. Open **Project Settings → Edge Functions / Secrets** and rotate any leaked function secrets.
4. Update all environments (production, staging, local):
   - frontend env (`VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`)
   - backend/server env (`SUPABASE_SERVICE_ROLE_KEY`, function secrets)
5. Redeploy frontend + backend immediately after updates.

## 2) Revoke/expire sessions tied to leaked JWT

### Dashboard path
- **Authentication → Users → (...) → Sign out user** for known affected accounts.

### SQL path (bulk)
Use SQL Editor with service role privileges to revoke sessions by user or globally.

```sql
-- Example: revoke all sessions for a specific compromised user
select auth.sign_out('00000000-0000-0000-0000-000000000000');

-- Example: revoke all sessions (use with caution)
-- Iterate over users and sign out each user.
```

> If your project does not expose `auth.sign_out`, use Dashboard bulk sign-out and rotate refresh token/session settings under Authentication settings.

## 3) Force re-authentication

1. In the app, invalidate local auth state by calling `supabase.auth.signOut()` on token/session errors.
2. Show a clear message: **"Your session expired for security reasons. Please sign in again."**
3. If impact is broad, publish a status/update message and request all users sign in again.

## 4) Scrub tokens from logs + prevent future leakage

1. Scrub historical log stores (Supabase logs, hosting logs, Sentry/observability tools) using token/JWT patterns:
   - `Bearer <token>`
   - JWT pattern `eyJ...`.
2. Delete or redact stored diagnostics payloads containing Authorization headers or tokens.
3. Keep only redacted values in client logs and error reporting.

## 5) Verification checklist

- [ ] Old leaked key no longer authenticates.
- [ ] New keys deployed to all environments.
- [ ] Affected users are signed out.
- [ ] Users are prompted to sign in again.
- [ ] Existing logs are scrubbed/redacted.
- [ ] New client diagnostics redact tokens automatically.

