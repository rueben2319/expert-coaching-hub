# Quick Fix Reference Guide

**For Developers:** Quick reference for the bugs that were fixed

---

## 🔴 CRITICAL FIX #1: AttendeeSelector Infinite Loop

**File:** `src/components/AttendeeSelector.tsx` (Line 41)

**The Problem:**
```typescript
// ❌ BAD - Missing dependencies, causes infinite loop
useEffect(() => {
  const allEmails = [...new Set([...clientEmails, ...manualEmailList])];
  onEmailsChange(allEmails);
}, [manualEmails, clients]); // Missing: selectedEmails, onEmailsChange
```

**The Fix:**
```typescript
// ✅ GOOD - All dependencies + change detection
useEffect(() => {
  const allEmails = [...new Set([...clientEmails, ...manualEmailList])];
  
  // Only update if actually changed
  const currentSorted = [...selectedEmails].sort().join(',');
  const newSorted = [...allEmails].sort().join(',');
  
  if (currentSorted !== newSorted) {
    onEmailsChange(allEmails);
  }
}, [manualEmails, clients, selectedEmails, onEmailsChange]);
```

**Lesson:** Always include ALL dependencies in useEffect. Use comparison to prevent unnecessary updates.

---

## 🔴 CRITICAL FIX #2: Hard-coded URL

**File:** `src/lib/supabaseFunctions.ts` (Line 87)

**The Problem:**
```typescript
// ❌ BAD - Hard-coded production URL
const functionUrl = `https://vbrxgaxjmpwusbbbzzgl.supabase.co/functions/v1/${functionName}`;
```

**The Fix:**
```typescript
// ✅ GOOD - Use environment variable
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
if (!SUPABASE_URL) {
  throw new Error('VITE_SUPABASE_URL environment variable is not set');
}
const functionUrl = `${SUPABASE_URL}/functions/v1/${functionName}`;
```

**Lesson:** NEVER hard-code URLs, API keys, or secrets. Always use environment variables.

---

## 🟠 HIGH FIX #3: Missing Error Handling

**File:** `src/hooks/useAuth.tsx` (Line 26)

**The Problem:**
```typescript
// ❌ BAD - Silent failure
const fetchUserRole = async (userId: string) => {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (!error && data) {
    setRole(data.role as UserRole);
  }
  // Error is ignored!
};
```

**The Fix:**
```typescript
// ✅ GOOD - Explicit error handling
const fetchUserRole = async (userId: string) => {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("Failed to fetch user role:", error);
    setRole(null);
    return;
  }

  if (data) {
    setRole(data.role as UserRole);
  } else {
    setRole(null);
  }
};
```

**Lesson:** Always handle BOTH success and error cases explicitly.

---

## 🟠 HIGH FIX #4: Authorization Bypass

**File:** `src/components/ProtectedRoute.tsx` (Line 27)

**The Problem:**
```typescript
// ❌ BAD - Missing null check
if (!user) {
  return <Navigate to="/auth" replace />;
}

if (allowedRoles && role && !allowedRoles.includes(role)) {
  return <Navigate to={`/${role}`} replace />;
}
// What if user exists but role is null?
```

**The Fix:**
```typescript
// ✅ GOOD - Complete null handling
if (!user) {
  return <Navigate to="/auth" replace />;
}

// Check for null role after loading
if (user && role === null && !loading) {
  console.warn("User authenticated but no role found");
  return <Navigate to="/" replace />;
}

if (allowedRoles && role && !allowedRoles.includes(role)) {
  return <Navigate to={`/${role}`} replace />;
}
```

**Lesson:** Always check for null/undefined in all code paths.

---

## 🟠 HIGH FIX #5: Division by Zero

**File:** `src/pages/coach/Analytics.tsx` (Multiple locations)

**The Problem:**
```typescript
// ❌ BAD - Can divide by zero
const percentage = (count / total) * 100; // NaN if total is 0
```

**The Fix:**
```typescript
// ✅ GOOD - Safe division helper
const safeDivide = (numerator: number, denominator: number, defaultValue = 0): number => {
  return denominator === 0 ? defaultValue : numerator / denominator;
};

const percentage = safeDivide(count, total, 0) * 100;
```

**Lesson:** Always check denominators before division. Create helper functions for common operations.

---

## 🟡 MEDIUM FIX #6: Input Validation

**File:** `supabase/functions/immediate-withdrawal/index.ts` (Line 100)

**The Problem:**
```typescript
// ❌ BAD - Minimal validation
const creditsNum = Number(credits_amount);
if (isNaN(creditsNum) || creditsNum <= 0) {
  throw new Error("Amount must be positive");
}
```

**The Fix:**
```typescript
// ✅ GOOD - Comprehensive validation
const MAX_WITHDRAWAL = 100000;
const MIN_WITHDRAWAL = 10;

const creditsNum = Number(credits_amount);

if (isNaN(creditsNum)) {
  throw new Error("Amount must be a valid number");
}

if (creditsNum < MIN_WITHDRAWAL) {
  throw new Error(`Minimum withdrawal is ${MIN_WITHDRAWAL} credits`);
}

if (creditsNum > MAX_WITHDRAWAL) {
  throw new Error(`Maximum withdrawal is ${MAX_WITHDRAWAL} credits`);
}

if (!Number.isInteger(creditsNum)) {
  throw new Error("Amount must be a whole number (no decimals)");
}
```

**Lesson:** Validate ALL inputs thoroughly. Check type, range, format, and business rules.

---

## 🟡 MEDIUM FIX #7: Production Logging

**File:** `src/lib/logger.ts`

**The Problem:**
```typescript
// ❌ BAD - Always logs
export const logger = {
  log: (...args: any[]) => {
    console.log(...args); // Logs in production!
  },
};
```

**The Fix:**
```typescript
// ✅ GOOD - Environment-aware
export const logger = {
  log: (...args: any[]) => {
    if (import.meta.env.DEV) {
      console.log(...args);
    }
  },
  error: (...args: any[]) => {
    console.error(...args);
    // TODO: Send to error tracking in production
  },
  debug: (...args: any[]) => {
    if (import.meta.env.DEV) {
      console.debug(...args);
    }
  },
};
```

**Lesson:** Use environment checks for logging. Only essential logs in production.

---

## 🎯 Common Patterns to Avoid

### ❌ Don't Do This:
1. Missing useEffect dependencies
2. Hard-coding URLs or secrets
3. Ignoring errors silently
4. Skipping null checks
5. Division without zero check
6. Minimal input validation
7. Production logging without checks

### ✅ Do This Instead:
1. Include ALL dependencies in useEffect
2. Use environment variables for config
3. Handle errors explicitly with logging
4. Check for null/undefined everywhere
5. Use helper functions for math operations
6. Validate inputs thoroughly
7. Use environment-aware logging

---

## 📚 Additional Resources

- Full bug details: See `BUG_REPORT.md`
- Fix summaries: See `BUGS_FIXED_SUMMARY.md`
- Overall audit: See `AUDIT_COMPLETE.md`

---

## 🔧 How to Use This Guide

1. **Before writing code:** Review common patterns
2. **During code review:** Check for these anti-patterns
3. **When fixing bugs:** Reference the relevant fix
4. **When onboarding:** Share this as a learning resource

---

**Last Updated:** 2025-10-23  
**Purpose:** Developer quick reference for common bug patterns
