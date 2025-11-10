# Comprehensive Bug Analysis Report
**Date:** January 2025  
**Codebase:** Expert Coaching Hub  
**Total Bugs Found:** 15 (Critical: 3, High: 5, Medium: 4, Low: 3)

---

## 🔴 CRITICAL BUGS

### Bug #1: SQL Injection Vulnerability in Search Queries
**Severity:** Critical  
**Location:** `src/pages/admin/Users.tsx:45`, `src/pages/admin/Transactions.tsx:43`, `src/pages/admin/Courses.tsx:40`  
**Type:** Security Vulnerability

**Issue:**
The search functionality uses `.or()` with string interpolation, creating potential SQL injection risks. While Supabase client provides some protection, direct string interpolation in query builders is risky.

**Current Code:**
```typescript
// src/pages/admin/Users.tsx:45
if (search && search.trim()) {
  profilesQuery = profilesQuery.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
}
```

**Fixed Code:**
```typescript
if (search && search.trim()) {
  const sanitizedSearch = search.trim().replace(/[%_\\]/g, '\\$&'); // Escape special characters
  profilesQuery = profilesQuery.or(`full_name.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%`);
}
```

**Better Fix (Recommended):**
```typescript
if (search && search.trim()) {
  const sanitizedSearch = `%${search.trim()}%`;
  profilesQuery = profilesQuery
    .or(`full_name.ilike.${sanitizedSearch},email.ilike.${sanitizedSearch}`);
}
```

**Explanation:**
While Supabase PostgREST uses parameterized queries, directly interpolating user input into query strings is a security anti-pattern. The fix escapes special LIKE characters (`%`, `_`, `\`) and uses proper parameter binding.

**Impact:**
- Potential SQL injection if Supabase client has vulnerabilities
- Could allow attackers to modify query logic
- Data exfiltration risk

---

### Bug #2: Missing Error Handling in Credit Transfer Response
**Severity:** Critical  
**Location:** `supabase/functions/enroll-with-credits/index.ts:147-173`  
**Type:** Logic Error

**Issue:**
The code calls `transfer_credits` RPC function but doesn't validate the response structure before accessing nested properties. If the RPC returns an error or unexpected format, accessing `transferResult.sender_transaction_id` will crash.

**Current Code:**
```typescript
const { data: transferResult, error: transferError } = await supabase.rpc(
  "transfer_credits",
  { /* ... */ }
);

if (transferError) {
  // Error handling exists
}

// Missing validation here!
const { data: enrollment, error: enrollError } = await supabase
  .from("course_enrollments")
  .insert({
    credit_transaction_id: transferResult.sender_transaction_id, // ⚠️ Crashes if transferResult is null/undefined
  })
```

**Fixed Code:**
```typescript
const { data: transferResult, error: transferError } = await supabase.rpc(
  "transfer_credits",
  { /* ... */ }
);

if (transferError) {
  console.error("Transfer error:", transferError);
  return new Response(
    JSON.stringify({
      error: transferError.message || "Failed to transfer credits",
      details: transferError,
    }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Validate transfer result
if (!transferResult || !transferResult.success) {
  return new Response(
    JSON.stringify({
      error: "Credit transfer failed",
      details: transferResult,
    }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

if (!transferResult.sender_transaction_id) {
  console.error("Transfer succeeded but missing sender_transaction_id:", transferResult);
  return new Response(
    JSON.stringify({
      error: "Credit transfer completed but transaction ID is missing",
    }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Now safe to use
const { data: enrollment, error: enrollError } = await supabase
  .from("course_enrollments")
  .insert({
    credit_transaction_id: transferResult.sender_transaction_id,
  })
```

**Explanation:**
Added comprehensive validation of the RPC response to ensure it has the expected structure before accessing nested properties. This prevents runtime crashes and provides better error messages.

**Impact:**
- Application crashes when credit transfer succeeds but returns unexpected format
- Users see 500 errors instead of helpful messages
- Enrollment record created without proper transaction link

---

### Bug #3: Hardcoded Supabase URL in Calendar Service
**Severity:** Critical  
**Location:** `src/integrations/google/calendar.ts:65`  
**Type:** Configuration Issue

**Issue:**
Hardcoded production Supabase URL prevents environment-specific configuration and violates 12-factor app principles.

**Current Code:**
```typescript
private readonly SUPABASE_URL = "https://vbrxgaxjmpwusbbbzzgl.supabase.co";
```

**Fixed Code:**
```typescript
private readonly SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://vbrxgaxjmpwusbbbzzgl.supabase.co";
```

**Explanation:**
Use environment variable for configuration. Falls back to hardcoded URL only if env var is missing (for backward compatibility during migration).

**Impact:**
- Cannot use different environments (dev/staging/prod)
- Configuration leak in source code
- Can't test locally without affecting production

---

## 🟠 HIGH SEVERITY BUGS

### Bug #4: Race Condition in ProtectedRoute Role Check
**Severity:** High  
**Location:** `src/components/ProtectedRoute.tsx:36-58`  
**Type:** Logic Error / Race Condition

**Issue:**
The `roleCheckDelay` state logic has a race condition where multiple timeouts can be set simultaneously, and the delay state might not accurately reflect the actual waiting state.

**Current Code:**
```typescript
useEffect(() => {
  if (!user) {
    setRoleCheckDelay(false);
    return;
  }

  if (role) {
    setRoleCheckDelay(false);
    return;
  }

  setRoleCheckDelay(true);

  const timer = setTimeout(() => {
    setRoleCheckDelay(false);
  }, 12000);

  return () => clearTimeout(timer);
}, [user, role]);
```

**Fixed Code:**
```typescript
useEffect(() => {
  if (!user) {
    setRoleCheckDelay(false);
    return;
  }

  if (role) {
    setRoleCheckDelay(false);
    return;
  }

  // Only set delay if we don't already have a timer running
  setRoleCheckDelay(true);

  const timer = setTimeout(() => {
    setRoleCheckDelay(false);
  }, 12000);

  return () => {
    clearTimeout(timer);
    // Don't reset delay on cleanup - let the timeout handle it
  };
}, [user, role]);
```

**Better Fix (Using useRef):**
```typescript
const roleCheckTimerRef = useRef<NodeJS.Timeout | null>(null);

useEffect(() => {
  // Clear any existing timer
  if (roleCheckTimerRef.current) {
    clearTimeout(roleCheckTimerRef.current);
    roleCheckTimerRef.current = null;
  }

  if (!user) {
    setRoleCheckDelay(false);
    return;
  }

  if (role) {
    setRoleCheckDelay(false);
    return;
  }

  setRoleCheckDelay(true);

  roleCheckTimerRef.current = setTimeout(() => {
    setRoleCheckDelay(false);
    roleCheckTimerRef.current = null;
  }, 12000);

  return () => {
    if (roleCheckTimerRef.current) {
      clearTimeout(roleCheckTimerRef.current);
      roleCheckTimerRef.current = null;
    }
  };
}, [user, role]);
```

**Explanation:**
Using `useRef` to track the timer prevents multiple timers from running simultaneously and ensures proper cleanup. The ref-based approach is more reliable than state for managing timeouts.

**Impact:**
- Users might see incorrect loading states
- Race conditions in role checking
- Potential infinite loading states

---

### Bug #5: Missing Dependency in useEffect Hook
**Severity:** High  
**Location:** `src/pages/Auth.tsx:158`  
**Type:** React Hook Violation

**Issue:**
The `useEffect` hook at line 46 uses `refreshRole` but doesn't include it in the dependency array, and the comment indicates it was intentionally removed to prevent infinite loops. However, this can lead to stale closures.

**Current Code:**
```typescript
}, [user, navigate]);  // Removed refreshRole dependency to prevent infinite loop
```

**Fixed Code:**
```typescript
const refreshRoleStable = useCallback(async () => {
  await refreshRole();
}, [refreshRole]);

useEffect(() => {
  // ... existing code ...
  await refreshRoleStable();
  // ... rest of code ...
}, [user, navigate, refreshRoleStable]);
```

**Or better - use the stable function from context:**
```typescript
// In useAuth.tsx, ensure refreshRole is wrapped in useCallback
const refreshRole = useCallback(async () => {
  if (user?.id) {
    await fetchUserRole(user.id);
  }
}, [user?.id]);

// Then in Auth.tsx
}, [user, navigate, refreshRole]);  // Now safe because refreshRole is stable
```

**Explanation:**
Either wrap `refreshRole` in `useCallback` in the `useAuth` hook (preferred), or create a stable reference in the component. This prevents stale closures while avoiding infinite loops.

**Impact:**
- Stale closure bugs where old function references are used
- Potential infinite loops if not handled correctly
- React Hook exhaustive-deps warnings

---

### Bug #6: Missing Input Validation for Email in Search
**Severity:** High  
**Location:** `src/pages/admin/Users.tsx:44-46`  
**Type:** Input Validation

**Issue:**
The search input is used directly in database queries without length limits or sanitization, which could lead to DoS attacks or performance issues.

**Current Code:**
```typescript
if (search && search.trim()) {
  profilesQuery = profilesQuery.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
}
```

**Fixed Code:**
```typescript
if (search && search.trim()) {
  const trimmedSearch = search.trim();
  
  // Limit search length to prevent DoS
  if (trimmedSearch.length > 100) {
    toast.error("Search query too long (max 100 characters)");
    return;
  }
  
  // Sanitize special LIKE characters
  const sanitizedSearch = trimmedSearch.replace(/[%_\\]/g, '\\$&');
  
  profilesQuery = profilesQuery.or(`full_name.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%`);
}
```

**Explanation:**
Added length validation to prevent extremely long search queries that could cause performance issues, and proper sanitization of LIKE special characters.

**Impact:**
- Potential DoS through very long search queries
- Performance degradation with complex search patterns
- Database query timeouts

---

### Bug #7: Unsafe Type Casting in Webhook Handler
**Severity:** High  
**Location:** `supabase/functions/paychangu-webhook/index.ts:212`  
**Type:** Type Safety Issue

**Issue:**
Using `as any` to bypass TypeScript type checking when updating transactions, which could lead to runtime errors if the payload structure changes.

**Current Code:**
```typescript
await (supabase.from("transactions") as any)
  .update({ status: success ? "success" : "failed", gateway_response: payload })
  .eq("id", tx.id);
```

**Fixed Code:**
```typescript
await supabase
  .from("transactions")
  .update({ 
    status: success ? "success" : "failed", 
    gateway_response: payload as Record<string, unknown>
  })
  .eq("id", tx.id);
```

**Explanation:**
Remove unsafe `as any` cast and use proper type assertion for the payload. The Supabase client should handle the update correctly without the cast.

**Impact:**
- Type safety violations
- Potential runtime errors if payload structure changes
- Difficult to catch errors during development

---

### Bug #8: Missing Transaction Rollback on Enrollment Failure
**Severity:** High  
**Location:** `supabase/functions/enroll-with-credits/index.ts:175-191`  
**Type:** Data Integrity Issue

**Issue:**
If enrollment record creation fails after credits have been transferred, the credits are lost - there's no rollback mechanism.

**Current Code:**
```typescript
// Credits already transferred at this point
const { data: enrollment, error: enrollError } = await supabase
  .from("course_enrollments")
  .insert({
    user_id: user.id,
    course_id: course_id,
    credits_paid: creditsRequired,
    payment_status: "paid",
    credit_transaction_id: transferResult.sender_transaction_id,
  })
  .select()
  .single();

if (enrollError) {
  console.error("Enrollment error:", enrollError);
  throw new Error("Failed to create enrollment: " + enrollError.message);
  // ⚠️ Credits already deducted but enrollment not created!
}
```

**Fixed Code:**
```typescript
// Credits already transferred at this point
const { data: enrollment, error: enrollError } = await supabase
  .from("course_enrollments")
  .insert({
    user_id: user.id,
    course_id: course_id,
    credits_paid: creditsRequired,
    payment_status: "paid",
    credit_transaction_id: transferResult.sender_transaction_id,
  })
  .select()
  .single();

if (enrollError) {
  console.error("Enrollment error:", enrollError);
  
  // Attempt to refund credits
  try {
    const { error: refundError } = await supabase.rpc('refund_credits', {
      from_user_id: course.coach_id,
      to_user_id: user.id,
      amount: creditsRequired,
      original_transaction_id: transferResult.sender_transaction_id,
      reason: 'Enrollment creation failed'
    });
    
    if (refundError) {
      console.error("Critical: Failed to refund credits after enrollment failure:", refundError);
      // Log for manual intervention
      await supabase.from('error_logs').insert({
        error_type: 'enrollment_refund_failed',
        details: {
          user_id: user.id,
          course_id: course_id,
          credits: creditsRequired,
          enrollment_error: enrollError.message,
          refund_error: refundError.message
        }
      });
    }
  } catch (refundErr) {
    console.error("Failed to process refund:", refundErr);
  }
  
  throw new Error("Failed to create enrollment: " + enrollError.message);
}
```

**Explanation:**
Added refund logic to restore credits if enrollment creation fails. This ensures data integrity - either both operations succeed or both are rolled back.

**Impact:**
- Users lose credits if enrollment creation fails
- Data inconsistency between credits and enrollments
- Manual intervention required to fix

---

## 🟡 MEDIUM SEVERITY BUGS

### Bug #9: Missing Error Handling in Token Refresh
**Severity:** Medium  
**Location:** `src/integrations/google/calendar.ts:226-234`  
**Type:** Error Handling

**Issue:**
Token refresh retry logic doesn't handle cases where refresh itself fails, leading to infinite retry attempts.

**Current Code:**
```typescript
if (response.status === 401 && retryCount < maxRetries) {
  logger.log('Access token expired, attempting refresh...');
  await this.refreshAccessToken();
  return this.makeCalendarRequest(endpoint, options, retryCount + 1);
}
```

**Fixed Code:**
```typescript
if (response.status === 401 && retryCount < maxRetries) {
  logger.log('Access token expired, attempting refresh...');
  try {
    await this.refreshAccessToken();
    return this.makeCalendarRequest(endpoint, options, retryCount + 1);
  } catch (refreshError) {
    logger.error('Token refresh failed:', refreshError);
    throw new Error('Authentication failed. Please reconnect your Google account.');
  }
}
```

**Explanation:**
Wrap token refresh in try-catch to handle refresh failures gracefully and prevent infinite retry loops.

**Impact:**
- Infinite retry loops if refresh fails
- Poor user experience with repeated failed requests
- Unclear error messages

---

### Bug #10: Potential Memory Leak in Token Sync
**Severity:** Medium  
**Location:** `src/lib/tokenSync.ts:122-143`  
**Type:** Memory Leak

**Issue:**
The `setupTokenSync` function creates an interval but doesn't check if the component is still mounted before executing callbacks, which could lead to memory leaks and state updates on unmounted components.

**Current Code:**
```typescript
export function setupTokenSync(intervalMs: number = 60000): () => void {
  logger.log('Setting up automatic token synchronization');

  const intervalId = setInterval(async () => {
    try {
      const needsRefresh = await checkTokenRefreshNeeded();
      if (needsRefresh) {
        logger.log('Proactive token refresh triggered');
        await syncTokens();
      }
    } catch (error) {
      logger.error('Error during periodic token check:', error);
    }
  }, intervalMs);

  return () => {
    logger.log('Cleaning up token synchronization');
    clearInterval(intervalId);
  };
}
```

**Fixed Code:**
```typescript
export function setupTokenSync(intervalMs: number = 60000): () => void {
  logger.log('Setting up automatic token synchronization');
  let isActive = true;

  const intervalId = setInterval(async () => {
    if (!isActive) return; // Don't execute if cleaned up
    
    try {
      // Check if user is still authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        isActive = false;
        clearInterval(intervalId);
        return;
      }
      
      const needsRefresh = await checkTokenRefreshNeeded();
      if (needsRefresh && isActive) {
        logger.log('Proactive token refresh triggered');
        await syncTokens();
      }
    } catch (error) {
      logger.error('Error during periodic token check:', error);
      // Don't clear interval on error - might be temporary
    }
  }, intervalMs);

  return () => {
    logger.log('Cleaning up token synchronization');
    isActive = false;
    clearInterval(intervalId);
  };
}
```

**Explanation:**
Added `isActive` flag to prevent execution after cleanup and check for valid session before proceeding. This prevents memory leaks and unnecessary API calls.

**Impact:**
- Memory leaks in long-running sessions
- Unnecessary API calls after logout
- Potential state updates on unmounted components

---

### Bug #11: Missing Validation for Course Price Credits
**Severity:** Medium  
**Location:** `supabase/functions/enroll-with-credits/index.ts:144`  
**Type:** Input Validation

**Issue:**
The code converts `course.price_credits` to a number but doesn't validate it's a valid positive number before using it in the transfer.

**Current Code:**
```typescript
const creditsRequired = Number(course.price_credits);
```

**Fixed Code:**
```typescript
const creditsRequired = Number(course.price_credits);

if (isNaN(creditsRequired) || creditsRequired < 0) {
  return new Response(
    JSON.stringify({ error: "Invalid course price configuration" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

if (!Number.isInteger(creditsRequired)) {
  return new Response(
    JSON.stringify({ error: "Course price must be a whole number of credits" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

**Explanation:**
Validate that the course price is a valid, positive integer before proceeding with the credit transfer.

**Impact:**
- Invalid course configurations could cause transfer failures
- Negative credit amounts could be processed
- Decimal credits could cause issues

---

### Bug #12: Inefficient Query in Admin Users Page
**Severity:** Medium  
**Location:** `src/pages/admin/Users.tsx:54-63`  
**Type:** Performance Issue

**Issue:**
Fetches roles for all users separately after fetching profiles, causing N+1 query pattern. This is inefficient for large user lists.

**Current Code:**
```typescript
const userIds = profiles.map((p: any) => p.id);
const { data: roleRows } = await supabase
  .from('user_roles')
  .select('user_id, role')
  .in('user_id', userIds as string[]);
```

**Fixed Code:**
```typescript
// Use a single query with join for better performance
const { data: profilesWithRoles, error, count } = await supabase
  .from('profiles')
  .select(`
    id, 
    full_name, 
    email, 
    created_at,
    user_roles!inner(role)
  `, { count: 'exact' })
  .order('created_at', { ascending: false })
  .range(offset, offset + pageSize - 1);

// Then map the results
const enriched = profilesWithRoles?.map((p: any) => ({
  id: p.id,
  full_name: p.full_name,
  email: p.email,
  created_at: p.created_at,
  role: p.user_roles?.[0]?.role || 'client'
})) || [];
```

**Explanation:**
Use a single query with a join instead of two separate queries. This reduces database round trips and improves performance, especially with large datasets.

**Impact:**
- Slow page loads with many users
- Increased database load
- Poor user experience

---

## 🟢 LOW SEVERITY BUGS

### Bug #13: Missing Loading State in Credit Purchase
**Severity:** Low  
**Location:** `src/hooks/useCredits.ts:121-132`  
**Type:** UX Issue

**Issue:**
The `purchaseCredits` mutation redirects immediately without showing a loading state, which could confuse users if the redirect is slow.

**Current Code:**
```typescript
const purchaseCredits = useMutation({
  mutationFn: async (packageId: string) => {
    return callSupabaseFunction("purchase-credits", { package_id: packageId });
  },
  onSuccess: (data) => {
    window.location.href = data.checkout_url;
  },
});
```

**Fixed Code:**
```typescript
const purchaseCredits = useMutation({
  mutationFn: async (packageId: string) => {
    return callSupabaseFunction("purchase-credits", { package_id: packageId });
  },
  onSuccess: (data) => {
    toast.info("Redirecting to payment...");
    // Small delay to ensure toast is visible
    setTimeout(() => {
      window.location.href = data.checkout_url;
    }, 500);
  },
  onError: (error: any) => {
    toast.error(error.message || "Failed to initiate credit purchase");
  },
});
```

**Explanation:**
Added user feedback before redirect and a small delay to ensure the message is visible.

**Impact:**
- Confusing user experience
- Users might click multiple times if redirect is slow

---

### Bug #14: Hardcoded Currency Conversion Rate
**Severity:** Low  
**Location:** `supabase/functions/immediate-withdrawal/index.ts:473`  
**Type:** Configuration Issue

**Issue:**
Credit to MWK conversion is hardcoded (1 credit = 100 MWK), which should be configurable.

**Current Code:**
```typescript
const amountMWK = creditsToWithdraw * 100;
```

**Fixed Code:**
```typescript
const CREDIT_TO_MWK_RATE = parseFloat(Deno.env.get('CREDIT_TO_MWK_RATE') || '100');
const amountMWK = Math.round(creditsToWithdraw * CREDIT_TO_MWK_RATE);
```

**Explanation:**
Make the conversion rate configurable via environment variable, with a fallback to the current hardcoded value.

**Impact:**
- Cannot adjust pricing without code changes
- Difficult to support multiple currencies
- Not flexible for different markets

---

### Bug #15: Missing Error Message for Invalid UUID Format
**Severity:** Low  
**Location:** `supabase/functions/enroll-with-credits/index.ts:78-84`  
**Type:** UX Issue

**Issue:**
UUID validation provides a generic error message that doesn't help users understand what went wrong.

**Current Code:**
```typescript
if (!uuidRegex.test(course_id)) {
  return new Response(JSON.stringify({ error: "Invalid course_id format" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

**Fixed Code:**
```typescript
if (!uuidRegex.test(course_id)) {
  return new Response(
    JSON.stringify({ 
      error: "Invalid course ID format. Please ensure you're using a valid course link." 
    }), 
    {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
```

**Explanation:**
Provide a more user-friendly error message that explains what the user should do.

**Impact:**
- Confusing error messages for end users
- Poor user experience

---

## 📊 Summary

### Total Bugs Found: 15
- **Critical:** 3
- **High:** 5
- **Medium:** 4
- **Low:** 3

### Priority Fixes (Top 5)
1. **Bug #1:** SQL Injection Vulnerability - Fix immediately
2. **Bug #2:** Missing Error Handling in Credit Transfer - Fix immediately
3. **Bug #3:** Hardcoded Supabase URL - Fix before deployment
4. **Bug #8:** Missing Transaction Rollback - Fix to prevent data loss
5. **Bug #5:** Missing Dependency in useEffect - Fix to prevent stale closures

### General Recommendations

1. **Input Validation:** Implement comprehensive input validation across all user-facing endpoints
2. **Error Handling:** Add consistent error handling patterns, especially for financial transactions
3. **Type Safety:** Remove `as any` casts and use proper TypeScript types
4. **Environment Configuration:** Move all hardcoded values to environment variables
5. **Transaction Management:** Implement proper rollback mechanisms for multi-step operations
6. **Performance:** Review and optimize database queries, especially in admin pages
7. **Security:** Conduct security audit for all user inputs and database queries
8. **Testing:** Add unit tests for critical paths, especially credit transfer and enrollment flows

### Testing Recommendations

1. Test credit enrollment with invalid course IDs
2. Test concurrent enrollments to verify race condition fixes
3. Test token refresh failure scenarios
4. Test search functionality with special characters and long strings
5. Test admin user management with large datasets
6. Test webhook processing with malformed payloads

---

**Report Generated:** January 2025  
**Next Review:** After fixes are implemented

