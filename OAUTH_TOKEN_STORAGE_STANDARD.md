# OAuth Token Storage Standard

## 📋 Overview

This document defines the **standardized approach** for OAuth token storage and retrieval across the Expert Coaching Hub application. Following this standard ensures consistent behavior, proper token refresh, and seamless synchronization between backend and frontend.

## 🎯 Chosen Strategy: Hybrid Approach

After analyzing the architecture and limitations, we've implemented a **hybrid storage strategy**:

### Primary Storage: User Metadata
- **Location:** `user_metadata` in Supabase Auth
- **Purpose:** Persistent storage of tokens, metadata, and refresh history
- **Access:** Backend Edge Functions (via `supabase.auth.admin`)

### Secondary Storage: Session Provider Tokens
- **Location:** `session.provider_token` and `session.provider_refresh_token`
- **Purpose:** Immediate access for frontend operations
- **Access:** Frontend code (via `supabase.auth.getSession()`)

### Synchronization Mechanism
- Backend refreshes tokens → Stores in user_metadata
- Frontend periodically syncs from metadata → Updates local session cache
- Manual refresh triggers immediate synchronization

## 🔧 Implementation Details

### Backend Token Management

#### 1. Token Storage (Edge Functions)

```typescript
import { TokenStorage } from "../_shared/token-storage.ts";
import { getValidatedGoogleToken, OAuthTokenManager } from "../_shared/oauth-token-manager.ts";

// Get and validate token (with automatic refresh)
const { accessToken, refreshToken, wasRefreshed } = await getValidatedGoogleToken(supabase);

// Store refreshed tokens
if (wasRefreshed) {
  await TokenStorage.storeTokens(
    supabase,
    userId,
    accessToken,
    refreshToken,
    expiresIn,
    scope
  );
  
  await TokenStorage.updateRefreshMetadata(supabase, userId);
}
```

#### 2. Making API Requests (Edge Functions)

```typescript
// Use OAuthTokenManager for all Google API calls
const response = await OAuthTokenManager.makeAuthenticatedRequest(
  'https://www.googleapis.com/calendar/v3/calendars/primary/events',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventData),
  },
  accessToken,
  refreshToken
);
```

### Frontend Token Management

#### 1. Token Retrieval and Usage

```typescript
import { googleCalendarService } from '@/integrations/google/calendar';

// Service automatically handles token refresh on 401 errors
const events = await googleCalendarService.listEvents('primary', {
  timeMin: startDate.toISOString(),
  maxResults: 50,
});
```

#### 2. Manual Token Synchronization

```typescript
import { syncTokens, forceTokenRefresh } from '@/lib/tokenSync';

// Sync tokens from backend (e.g., after user action)
await syncTokens();

// Force immediate refresh
await forceTokenRefresh();
```

#### 3. Automatic Token Synchronization

```typescript
// In App.tsx or main component
import { setupTokenSync } from '@/lib/tokenSync';

useEffect(() => {
  // Set up automatic token sync (checks every 60 seconds)
  const cleanup = setupTokenSync(60000);
  
  return cleanup; // Cleanup on unmount
}, []);
```

## 📊 Token Lifecycle

### 1. Initial Authentication

```
User → OAuth Flow → Google → Tokens → Supabase Session
                                    ↓
                              User Metadata
```

- Tokens stored in both session and metadata
- Refresh token persisted for long-term access
- Token expiry tracked in metadata

### 2. Token Usage (Frontend)

```
Frontend → Check Session → Token Valid? → Use Token
                              ↓ No
                        Refresh Token → Update Session → Retry
```

### 3. Token Usage (Backend)

```
Edge Function → getValidatedGoogleToken() → Validate Token
                                              ↓ Invalid
                                      Refresh via Google
                                              ↓
                                      Store in Metadata
                                              ↓
                                    Return New Token
```

### 4. Token Synchronization

```
Backend Refresh → Store in Metadata
                       ↓
Frontend Detects → syncTokens()
                       ↓
                refreshSession()
                       ↓
            Updated Session Tokens
```

## 🗂️ Storage Schema

### User Metadata Structure

```typescript
interface UserTokenMetadata {
  // Token data
  google_access_token?: string;
  google_refresh_token?: string;
  google_token_expires_at?: string; // ISO 8601
  google_token_scope?: string;
  
  // Status flags
  google_calendar_connected?: boolean;
  
  // Refresh tracking
  last_token_refresh?: string; // ISO 8601
  token_refresh_count?: number;
}
```

### Session Structure

```typescript
interface Session {
  access_token: string; // Supabase session token
  provider_token?: string; // Google access token
  provider_refresh_token?: string; // Google refresh token
  expires_at: number;
  user: User;
}
```

## 🔄 Token Refresh Flow

### Automatic Refresh (Backend)

1. **Edge Function receives request**
2. **Call `getValidatedGoogleToken()`**
3. **Token validation:**
   - Valid → Return token
   - Invalid → Refresh via Google
4. **Store refreshed token in metadata**
5. **Update refresh count and timestamp**
6. **Return to Edge Function for use**

### Automatic Refresh (Frontend)

1. **API call returns 401 Unauthorized**
2. **Detect expired token**
3. **Call backend to refresh token**
4. **Sync refreshed token to session**
5. **Retry original API call**

### Manual Refresh

1. **User clicks "Refresh Token" button**
2. **Call `refresh-google-token` Edge Function**
3. **Backend refreshes and stores token**
4. **Frontend calls `syncTokens()`**
5. **Session updated with new token**
6. **UI shows success message**

## ✅ Best Practices

### DO ✅

1. **Always use `getValidatedGoogleToken()` in Edge Functions**
   ```typescript
   const { accessToken, refreshToken } = await getValidatedGoogleToken(supabase);
   ```

2. **Use `OAuthTokenManager.makeAuthenticatedRequest()` for Google API calls**
   ```typescript
   const response = await OAuthTokenManager.makeAuthenticatedRequest(url, options, accessToken, refreshToken);
   ```

3. **Call `syncTokens()` after backend token operations**
   ```typescript
   await forceTokenRefresh();
   await syncTokens(); // Ensure frontend has latest token
   ```

4. **Set up automatic token sync in your app**
   ```typescript
   const cleanup = setupTokenSync(60000);
   ```

5. **Track token refresh events in analytics**
   ```typescript
   await supabase.from('meeting_analytics').insert({
     event_type: 'token_refreshed',
     event_data: { refresh_source: 'automatic', ... }
   });
   ```

### DON'T ❌

1. **Don't manually implement token refresh logic**
   ```typescript
   // ❌ Don't do this
   const tokenData = await fetch('https://oauth2.googleapis.com/token', ...);
   
   // ✅ Do this instead
   const { accessToken } = await getValidatedGoogleToken(supabase);
   ```

2. **Don't store tokens in plain state or localStorage**
   ```typescript
   // ❌ Don't do this
   localStorage.setItem('google_token', token);
   
   // ✅ Tokens are managed by Supabase Auth
   ```

3. **Don't make Google API calls without retry logic**
   ```typescript
   // ❌ Don't do this
   const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }});
   
   // ✅ Do this
   const response = await OAuthTokenManager.makeAuthenticatedRequest(url, options, token, refreshToken);
   ```

4. **Don't ignore token expiry**
   ```typescript
   // ❌ Don't do this
   const token = session.provider_token; // May be expired!
   
   // ✅ Do this
   const token = await getAccessToken(); // Validates and refreshes if needed
   ```

5. **Don't forget to sync after backend refresh**
   ```typescript
   // ❌ Don't do this
   await fetch('/functions/v1/refresh-google-token', ...);
   // Token refreshed but frontend still has old token!
   
   // ✅ Do this
   await fetch('/functions/v1/refresh-google-token', ...);
   await syncTokens(); // Sync with frontend
   ```

## 🔍 Debugging

### Check Token Status

```typescript
// Frontend
import { TokenDebugger } from '@/lib/tokenDebug';

// Log comprehensive token status
await TokenDebugger.logTokenStatus();

// Get token info programmatically
const tokenInfo = await TokenDebugger.getTokenInfo();
console.log('Has token:', tokenInfo.hasProviderToken);
console.log('Token expires:', tokenInfo.tokenExpiry);
```

### Backend Token Status

```typescript
// Call get-token-status Edge Function
const { data: { session } } = await supabase.auth.getSession();
const response = await fetch('/functions/v1/get-token-status', {
  headers: { Authorization: `Bearer ${session.access_token}` }
});
const status = await response.json();
console.log('Token status:', status);
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "No provider token" | User not signed in with Google | Re-authenticate with Google OAuth |
| "Token expired" errors | Token expired, no sync | Call `syncTokens()` or `forceTokenRefresh()` |
| Refresh doesn't work | Session not updated | Ensure `supabase.auth.refreshSession()` is called |
| Inconsistent token state | Cache not cleared | Clear `sessionCache` after refresh |

## 📚 Related Files

### Backend
- `/workspace/supabase/functions/_shared/oauth-token-manager.ts` - Core token management
- `/workspace/supabase/functions/_shared/token-storage.ts` - Token storage utilities
- `/workspace/supabase/functions/refresh-google-token/index.ts` - Manual refresh endpoint
- `/workspace/supabase/functions/get-token-status/index.ts` - Token status endpoint

### Frontend
- `/workspace/src/integrations/google/calendar.ts` - Google Calendar service with token refresh
- `/workspace/src/lib/tokenSync.ts` - Token synchronization utilities
- `/workspace/src/lib/tokenDebug.ts` - Token debugging tools
- `/workspace/src/components/TokenManagementDashboard.tsx` - UI for token management

## 🚀 Migration Guide

### For Existing Edge Functions

1. **Add imports:**
   ```typescript
   import { getValidatedGoogleToken, OAuthTokenManager } from "../_shared/oauth-token-manager.ts";
   import { TokenStorage } from "../_shared/token-storage.ts";
   ```

2. **Replace manual token logic:**
   ```typescript
   // Before
   const { data: session } = await supabase.auth.getSession();
   const accessToken = session.session.provider_token;
   
   // After
   const { accessToken, refreshToken, wasRefreshed } = await getValidatedGoogleToken(supabase);
   ```

3. **Use authenticated request helper:**
   ```typescript
   // Before
   const response = await fetch(url, {
     headers: { Authorization: `Bearer ${token}` }
   });
   
   // After
   const response = await OAuthTokenManager.makeAuthenticatedRequest(
     url, options, accessToken, refreshToken
   );
   ```

### For Frontend Components

1. **Use Google Calendar service:**
   ```typescript
   import { googleCalendarService } from '@/integrations/google/calendar';
   // Service handles token refresh automatically
   ```

2. **Add token sync to your app:**
   ```typescript
   import { setupTokenSync } from '@/lib/tokenSync';
   
   useEffect(() => {
     const cleanup = setupTokenSync();
     return cleanup;
   }, []);
   ```

3. **Call sync after manual operations:**
   ```typescript
   await someBackendOperation();
   await syncTokens(); // Ensure frontend has latest token
   ```

## ✨ Benefits of This Standard

1. **Consistency:** All components handle tokens the same way
2. **Reliability:** Automatic refresh reduces errors
3. **Maintainability:** Centralized logic, easy to update
4. **Debugging:** Clear flow, easy to trace issues
5. **Security:** Tokens managed by Supabase, not exposed unnecessarily
6. **UX:** Seamless experience, no re-auth required

---

**Last Updated:** 2025-10-23  
**Version:** 1.0  
**Status:** ✅ Implemented and Ready
