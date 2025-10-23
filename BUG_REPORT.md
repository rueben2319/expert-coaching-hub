# Bug Report & Fixes

**Date:** 2025-10-23  
**Analysis Type:** Comprehensive codebase audit  
**Severity Levels:** 🔴 Critical | 🟠 High | 🟡 Medium | 🔵 Low

---

## Summary

Found **8 significant bugs** across frontend components, backend functions, and integration code. Issues range from infinite render loops to security vulnerabilities and performance problems.

---

## 🔴 CRITICAL BUGS

### 1. Infinite Re-render Loop in AttendeeSelector Component
**File:** `src/components/AttendeeSelector.tsx` (lines 41-53)  
**Severity:** 🔴 Critical  
**Type:** Logic Error / Performance Issue

**Problem:**
```typescript
useEffect(() => {
  const manualEmailList = manualEmails
    .split(",")
    .map(email => email.trim())
    .filter(email => email && email.includes("@"));
  
  const clientEmails = selectedEmails.filter(email => 
    clients?.some(client => client.email === email)
  );
  
  const allEmails = [...new Set([...clientEmails, ...manualEmailList])];
  onEmailsChange(allEmails); // ❌ This causes infinite loop!
}, [manualEmails, clients]); // ❌ Missing onEmailsChange and selectedEmails
```

**Impact:**
- Causes infinite re-render loop when parent component re-renders
- `onEmailsChange` callback triggers parent state update
- Parent re-renders, passing new `onEmailsChange` reference
- useEffect runs again, creating infinite loop
- Severely degrades performance, may crash browser

**Fix:** Add missing dependencies and prevent unnecessary updates
```typescript
useEffect(() => {
  const manualEmailList = manualEmails
    .split(",")
    .map(email => email.trim())
    .filter(email => email && email.includes("@"));
  
  const clientEmails = selectedEmails.filter(email => 
    clients?.some(client => client.email === email)
  );
  
  const allEmails = [...new Set([...clientEmails, ...manualEmailList])];
  
  // Only update if emails actually changed
  if (JSON.stringify(allEmails.sort()) !== JSON.stringify(selectedEmails.sort())) {
    onEmailsChange(allEmails);
  }
}, [manualEmails, clients, selectedEmails, onEmailsChange]);
```

---

### 2. Hard-coded Supabase URL (Security Vulnerability)
**File:** `src/lib/supabaseFunctions.ts` (line 87)  
**Severity:** 🔴 Critical  
**Type:** Security Vulnerability / Configuration Error

**Problem:**
```typescript
const functionUrl = `https://vbrxgaxjmpwusbbbzzgl.supabase.co/functions/v1/${functionName}`;
```

**Impact:**
- Hard-coded production URL exposed in source code
- Makes it impossible to test with different environments
- Security risk if URL needs to change
- Violates environment variable best practices

**Fix:** Use environment variable
```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const functionUrl = `${SUPABASE_URL}/functions/v1/${functionName}`;
```

---

## 🟠 HIGH SEVERITY BUGS

### 3. Missing Error Handling in Role Fetch
**File:** `src/hooks/useAuth.tsx` (lines 26-36)  
**Severity:** 🟠 High  
**Type:** Error Handling Issue

**Problem:**
```typescript
const fetchUserRole = async (userId: string) => {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (!error && data) {
    setRole(data.role as UserRole);
  }
  // ❌ No error handling - role stays null on error
};
```

**Impact:**
- If role fetch fails, user has null role indefinitely
- Protected routes may malfunction
- No feedback to user about authentication issues
- Silent failures are difficult to debug

**Fix:** Add proper error handling and logging
```typescript
const fetchUserRole = async (userId: string) => {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("Failed to fetch user role:", error);
    // Set default role or show error to user
    setRole(null);
    return;
  }
  
  if (data) {
    setRole(data.role as UserRole);
  }
};
```

---

### 4. Race Condition in ProtectedRoute
**File:** `src/components/ProtectedRoute.tsx` (lines 27-28)  
**Severity:** 🟠 High  
**Type:** Logic Error

**Problem:**
```typescript
if (allowedRoles && role && !allowedRoles.includes(role)) {
  return <Navigate to={`/${role}`} replace />;
}
// ❌ What if role is null but user is authenticated?
```

**Impact:**
- If `role` is null but user is authenticated, component renders children
- Bypasses role-based access control
- Security vulnerability allowing unauthorized access

**Fix:** Explicitly handle null role case
```typescript
if (!user) {
  return <Navigate to="/auth" replace />;
}

// Wait for role to be loaded if user is authenticated
if (user && role === null && !loading) {
  // Role should be loaded by now, redirect to error or default page
  return <Navigate to="/" replace />;
}

if (allowedRoles && role && !allowedRoles.includes(role)) {
  return <Navigate to={`/${role}`} replace />;
}
```

---

### 5. Division by Zero in Analytics
**File:** `src/pages/coach/Analytics.tsx` (multiple locations)  
**Severity:** 🟠 High  
**Type:** Logic Error / Edge Case

**Problem:**
```typescript
// Line 139
const completionRate = studentProgresses.filter(p => p >= 100).length /
  (studentProgresses.length || 1) * 100;

// Line 164
) / (totalEnrollments || 1);

// Line 560
value={(analyticsData.courseAnalytics.flatMap(c => c.students)
  .filter(s => s.progress < 25).length / analyticsData.totalEnrollments) * 100}
// ❌ No check for zero totalEnrollments
```

**Impact:**
- When `totalEnrollments` is 0, division produces Infinity or NaN
- UI displays invalid percentages
- Progress bars may break
- Poor user experience for coaches with no students

**Fix:** Add safe division helper and proper checks
```typescript
// Add helper function
const safeDivide = (numerator: number, denominator: number, defaultValue = 0) => {
  return denominator === 0 ? defaultValue : numerator / denominator;
};

// Use in calculations
const completionRate = safeDivide(
  studentProgresses.filter(p => p >= 100).length,
  studentProgresses.length,
  0
) * 100;

// For progress bars
value={analyticsData.totalEnrollments > 0 
  ? (studentsInRange / analyticsData.totalEnrollments) * 100 
  : 0}
```

---

## 🟡 MEDIUM SEVERITY BUGS

### 6. Potential Memory Leak in Google Calendar Token Refresh
**File:** `src/integrations/google/calendar.ts` (lines 60-86)  
**Severity:** 🟡 Medium  
**Type:** Performance Issue

**Problem:**
```typescript
async getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('No active session. Please sign in.');
  }

  // Multiple session calls without caching
  const { data: { user } } = await supabase.auth.getUser();
  // ❌ No caching, multiple API calls for same data
}
```

**Impact:**
- Multiple redundant API calls to Supabase
- Increased latency for calendar operations
- Potential rate limiting issues
- Unnecessary network overhead

**Fix:** Cache session data and reuse it
```typescript
private sessionCache: { session: any; timestamp: number } | null = null;
private CACHE_DURATION = 5000; // 5 seconds

async getAccessToken(): Promise<string> {
  const now = Date.now();
  
  // Use cached session if recent
  if (this.sessionCache && (now - this.sessionCache.timestamp) < this.CACHE_DURATION) {
    if (this.sessionCache.session?.provider_token) {
      return this.sessionCache.session.provider_token;
    }
  }
  
  // Fetch fresh session
  const { data: { session } } = await supabase.auth.getSession();
  this.sessionCache = { session, timestamp: now };
  
  if (!session) {
    throw new Error('No active session. Please sign in.');
  }

  if (session.provider_token) {
    return session.provider_token;
  }

  // ... rest of logic
}
```

---

### 7. Missing Validation in Withdrawal Function
**File:** `supabase/functions/immediate-withdrawal/index.ts` (lines 100-122)  
**Severity:** 🟡 Medium  
**Type:** Input Validation Issue

**Problem:**
```typescript
function validateRequestBody(body: any) {
  const { credits_amount, payment_method, payment_details } = body;
  if (!credits_amount || !payment_method || !payment_details) {
    // ... validation
  }

  const creditsNum = Number(credits_amount);
  if (isNaN(creditsNum) || creditsNum <= 0) throw new Error("Amount must be positive");
  // ❌ No maximum limit check
  // ❌ No check for fractional credits
}
```

**Impact:**
- Users could request astronomically large withdrawals
- No validation for reasonable withdrawal amounts
- Could bypass business logic limits
- Potential for abuse or system errors

**Fix:** Add comprehensive validation
```typescript
const MAX_WITHDRAWAL = 100000; // Define business limit
const MIN_WITHDRAWAL = 10; // Minimum withdrawal

function validateRequestBody(body: any) {
  const { credits_amount, payment_method, payment_details } = body;
  if (!credits_amount || !payment_method || !payment_details) {
    const missing = ["credits_amount", "payment_method", "payment_details"].filter(
      (k) => !body[k]
    );
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }

  const creditsNum = Number(credits_amount);
  
  // Comprehensive validation
  if (isNaN(creditsNum)) {
    throw new Error("Amount must be a valid number");
  }
  
  if (creditsNum <= 0) {
    throw new Error("Amount must be positive");
  }
  
  if (creditsNum < MIN_WITHDRAWAL) {
    throw new Error(`Minimum withdrawal is ${MIN_WITHDRAWAL} credits`);
  }
  
  if (creditsNum > MAX_WITHDRAWAL) {
    throw new Error(`Maximum withdrawal is ${MAX_WITHDRAWAL} credits`);
  }
  
  if (!Number.isInteger(creditsNum)) {
    throw new Error("Amount must be a whole number");
  }

  // ... rest of validation
}
```

---

### 8. Excessive Console Logging in Production
**File:** Multiple files (206 instances found)  
**Severity:** 🟡 Medium  
**Type:** Performance / Security Issue

**Problem:**
- 206 console.log/console.error statements found across codebase
- Many in production code, including sensitive data logging
- Examples:
  - `purchase-credits/index.ts`: Logs payment secrets (line 139)
  - `supabaseFunctions.ts`: Logs session tokens (line 84)

**Impact:**
- Performance overhead in production
- Potential exposure of sensitive data in browser console
- Cluttered console makes debugging harder
- Security risk if API keys/tokens are logged

**Fix:** Implement proper logging utility with environment checks
```typescript
// lib/logger.ts (already exists, but not used everywhere)
export const logger = {
  log: (...args: any[]) => {
    if (import.meta.env.DEV) {
      console.log(...args);
    }
  },
  error: (...args: any[]) => {
    if (import.meta.env.DEV) {
      console.error(...args);
    } else {
      // Send to error tracking service in production
      // e.g., Sentry, LogRocket, etc.
    }
  },
  // Never log these in production
  debug: (...args: any[]) => {
    if (import.meta.env.DEV) {
      console.debug(...args);
    }
  }
};

// Replace all console.log with logger.log
// Replace all console.error with logger.error
```

---

## 🔵 LOW SEVERITY ISSUES

### 9. Inefficient Array Operations in Analytics
**File:** `src/pages/coach/Analytics.tsx` (lines 558-593)  
**Severity:** 🔵 Low  
**Type:** Performance Issue

**Problem:**
```typescript
// Repeated filtering of same array
analyticsData.courseAnalytics.flatMap(c => c.students).filter(s => s.progress < 25).length
analyticsData.courseAnalytics.flatMap(c => c.students).filter(s => s.progress >= 25 && s.progress < 50).length
// ... repeated 5 times
```

**Impact:**
- Unnecessary repeated array operations
- O(n*m) complexity when O(n) is sufficient
- Minor performance issue with large datasets

**Fix:** Compute once and cache
```typescript
const allStudents = useMemo(() => 
  analyticsData?.courseAnalytics.flatMap(c => c.students) || [], 
  [analyticsData]
);

const studentsByProgress = useMemo(() => ({
  '0-25': allStudents.filter(s => s.progress < 25).length,
  '25-50': allStudents.filter(s => s.progress >= 25 && s.progress < 50).length,
  '50-75': allStudents.filter(s => s.progress >= 50 && s.progress < 75).length,
  '75-100': allStudents.filter(s => s.progress >= 75 && s.progress < 100).length,
  'completed': allStudents.filter(s => s.progress >= 100).length,
}), [allStudents]);
```

---

## Recommendations

### Immediate Actions (Critical & High)
1. ✅ Fix AttendeeSelector infinite loop (Bug #1)
2. ✅ Replace hard-coded URL with environment variable (Bug #2)
3. ✅ Add error handling to role fetch (Bug #3)
4. ✅ Fix ProtectedRoute authorization logic (Bug #4)
5. ✅ Add safe division helper for Analytics (Bug #5)

### Short-term (Medium)
6. Implement token caching (Bug #6)
7. Add comprehensive input validation (Bug #7)
8. Replace console.log with logger utility (Bug #8)

### Long-term (Low & General)
9. Optimize analytics calculations (Bug #9)
10. Add comprehensive error tracking (Sentry/LogRocket)
11. Implement unit tests for critical functions
12. Add ESLint rules for missing dependencies in hooks
13. Set up pre-commit hooks for code quality checks

---

## Testing Checklist

After applying fixes, test:
- [ ] AttendeeSelector doesn't cause re-renders
- [ ] Role-based routing works correctly
- [ ] Analytics displays correctly with 0 students
- [ ] Environment variables work in all environments
- [ ] Withdrawal validation prevents invalid amounts
- [ ] No sensitive data in production console
- [ ] Calendar token refresh works without memory leaks

---

**Report Generated:** 2025-10-23  
**Total Bugs Found:** 9  
**Critical:** 2 | **High:** 3 | **Medium:** 3 | **Low:** 1
