# Bug Report and Fixes - Expert Coaching Hub

**Date:** October 29, 2025  
**Severity Levels:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## 🔴 CRITICAL BUGS

### BUG #1: Hardcoded Supabase URL (Security Vulnerability)
**Severity:** 🔴 CRITICAL  
**Location:** `src/lib/meetingUtils.ts:6`, `src/lib/tokenSync.ts:11`  
**Risk:** Configuration leak, environment mismatch

**Problem:**
```typescript
// meetingUtils.ts line 6
const SUPABASE_URL = "https://vbrxgaxjmpwusbbbzzgl.supabase.co";

// tokenSync.ts line 11
const SUPABASE_URL = "https://vbrxgaxjmpwusbbbzzgl.supabase.co";
```

**Issues:**
1. **Security:** Hardcoded production URL in source code
2. **Maintainability:** URL duplicated in multiple files
3. **Environment mismatch:** Won't work in dev/staging environments
4. **Configuration drift:** Can't switch environments without code changes

**Impact:**
- Development/staging environments will call production API
- Can't test Edge Functions locally
- Violates 12-factor app principles
- Potential data corruption across environments

**Fix:**
Use environment variable from Supabase client:

```typescript
// BEFORE
const SUPABASE_URL = "https://vbrxgaxjmpwusbbbzzgl.supabase.co";

// AFTER
import { supabase } from "@/integrations/supabase/client";

// Get URL from environment
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
```

---

### BUG #2: XSS Vulnerability via dangerouslySetInnerHTML
**Severity:** 🔴 CRITICAL  
**Location:** `src/components/content/TextContent.tsx:254`  
**Risk:** Cross-Site Scripting (XSS) attack

**Problem:**
```typescript
<div
  dangerouslySetInnerHTML={{ __html: getRenderedHtml() }}
/>
```

**Issues:**
1. **Security:** Even with sanitization, `dangerouslySetInnerHTML` is risky
2. **DOM-based XSS:** Sanitizer may have bypasses
3. **Maintenance:** Easy to break sanitization in future edits
4. **Trust boundary:** Relies on perfect sanitization

**Attack Vector:**
```html
<!-- Potential bypass -->
<img src=x onerror="alert('XSS')">
<a href="javascript:alert('XSS')">Click</a>
```

**Current Mitigation:**
The code DOES have sanitization (lines 162-219), which is good:
- Removes `<script>`, `<iframe>`, `<object>`, `<embed>`
- Strips event handlers (`onclick`, etc.)
- Blocks `javascript:` and `data:` URLs

**However:**
- DOMParser-based sanitization can have edge cases
- New XSS vectors discovered regularly
- No CSP (Content Security Policy) headers

**Recommended Fix:**
Use a battle-tested sanitization library:

```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

```typescript
import DOMPurify from 'dompurify';

// Replace getRenderedHtml() with:
const getRenderedHtml = () => {
  const text = content?.text ?? "";
  const format = content?.format ?? "plain";
  
  let html = "";
  if (format === "html") html = text;
  else if (format === "markdown") html = markdownToHtml(text);
  else html = `<p>${escapeHtml(text).replaceAll("\n", "<br/>")}</p>`;
  
  // Use DOMPurify for robust sanitization
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3'],
    ALLOWED_ATTR: ['href', 'rel', 'target'],
    ALLOW_DATA_ATTR: false,
  });
};
```

---

### BUG #3: Race Condition in Auth Flow
**Severity:** 🔴 CRITICAL  
**Location:** `src/hooks/useAuth.tsx:99-152`, `src/pages/Auth.tsx:45-152`  
**Risk:** Authentication bypass, role confusion

**Problem:**
```typescript
// useAuth.tsx - Two separate calls to getSession
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(...);
  
  supabase.auth.getSession().then(({ data: { session } }) => {
    // This runs AFTER onAuthStateChange
    // Can overwrite state with stale data
  });
}, []);
```

**Issues:**
1. **Race condition:** `onAuthStateChange` and `getSession` race
2. **Duplicate state updates:** `setLoading(false)` called twice
3. **Stale data:** Second call might overwrite fresh data from first
4. **Role confusion:** User might see wrong role briefly

**Scenario:**
```
Time 0ms:  useEffect runs
Time 10ms: onAuthStateChange fires → setUser(user1), setRole('client')
Time 15ms: getSession resolves → setUser(user2), setRole(null)  ← BUG!
```

**Fix:**
```typescript
useEffect(() => {
  let isMounted = true;

  // Single source of truth
  const initializeAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!isMounted) return;
    
    setSession(session);
    setUser(session?.user ?? null);
    
    if (session?.user) {
      await fetchUserRole(session.user.id);
      await fetchUserProfile(session.user.id);
    }
    
    setLoading(false);
  };

  // Set up listener AFTER initial load
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (!isMounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchUserRole(session.user.id);
        await fetchUserProfile(session.user.id);
      } else {
        setRole(null);
      }
    }
  );

  initializeAuth();

  return () => {
    isMounted = false;
    subscription.unsubscribe();
  };
}, []);
```

---

## 🟠 HIGH SEVERITY BUGS

### BUG #4: Missing Error Boundaries on Lazy Routes
**Severity:** 🟠 HIGH  
**Location:** `src/App.tsx:82-309`  
**Risk:** White screen of death on chunk load failure

**Problem:**
```typescript
<Suspense fallback={<PageLoader />}>
  <Routes>
    {/* If lazy chunk fails to load, entire app crashes */}
  </Routes>
</Suspense>
```

**Issues:**
1. **No error handling:** Chunk load failures show blank screen
2. **Network errors:** Slow/flaky connections cause failures
3. **Cache issues:** Stale chunks after deployment
4. **Poor UX:** No retry mechanism

**Scenario:**
```
1. User visits /coach/analytics
2. analytics-chunk.js fails to load (network error)
3. Suspense has no error boundary
4. App shows blank screen forever
```

**Fix:**
```typescript
// Create ChunkLoadError component
const ChunkLoadError = ({ error, resetError }: { error: Error, resetError: () => void }) => (
  <div className="flex flex-col items-center justify-center min-h-screen p-4">
    <h2 className="text-2xl font-bold mb-4">Failed to Load Page</h2>
    <p className="text-muted-foreground mb-4">
      {error.message || "The page failed to load. This might be due to a network issue."}
    </p>
    <div className="flex gap-2">
      <Button onClick={() => window.location.reload()}>
        Reload Page
      </Button>
      <Button variant="outline" onClick={resetError}>
        Try Again
      </Button>
    </div>
  </div>
);

// Wrap Suspense in ErrorBoundary
<ErrorBoundary FallbackComponent={ChunkLoadError}>
  <Suspense fallback={<PageLoader />}>
    <Routes>...</Routes>
  </Suspense>
</ErrorBoundary>
```

---

### BUG #5: Unvalidated User Input in Meeting Creation
**Severity:** 🟠 HIGH  
**Location:** `src/lib/meetingUtils.ts:34-118`  
**Risk:** Data corruption, injection attacks

**Problem:**
```typescript
static async createMeeting(meetingData: MeetingData): Promise<DatabaseMeeting> {
  // No validation of meetingData fields
  // summary, description, emails go straight to database
  
  const meetingInsert: DatabaseMeetingInsert = {
    summary: meetingData.summary,  // ← No sanitization!
    description: meetingData.description || null,  // ← No sanitization!
    attendees: allAttendeeEmails,  // ← No email validation!
  };
}
```

**Issues:**
1. **No input validation:** Accepts any string for summary/description
2. **No email validation:** Can insert invalid emails
3. **No length limits:** Can cause database errors
4. **SQL injection risk:** Though Supabase client escapes, defense in depth needed

**Attack Vectors:**
```typescript
// Malicious input
{
  summary: "<script>alert('xss')</script>".repeat(1000),  // 100KB string
  description: "'; DROP TABLE meetings; --",
  attendeeEmails: ["not-an-email", "javascript:alert(1)"]
}
```

**Fix:**
```typescript
import { z } from 'zod';

const MeetingDataSchema = z.object({
  summary: z.string()
    .min(3, "Summary must be at least 3 characters")
    .max(200, "Summary too long")
    .regex(/^[a-zA-Z0-9\s\-:,.'!?]+$/, "Summary contains invalid characters"),
  description: z.string()
    .max(2000, "Description too long")
    .optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  attendeeEmails: z.array(z.string().email()).min(1).max(50),
  courseId: z.string().uuid().optional(),
}).refine(data => new Date(data.endTime) > new Date(data.startTime), {
  message: "End time must be after start time",
});

static async createMeeting(meetingData: MeetingData): Promise<DatabaseMeeting> {
  // Validate input
  const validated = MeetingDataSchema.parse(meetingData);
  
  // Sanitize strings
  const sanitizedSummary = validated.summary.trim();
  const sanitizedDescription = validated.description?.trim();
  
  // ... rest of function
}
```

---

### BUG #6: Infinite Loop Risk in Auth.tsx
**Severity:** 🟠 HIGH  
**Location:** `src/pages/Auth.tsx:45-152`  
**Risk:** Browser freeze, excessive API calls

**Problem:**
```typescript
useEffect(() => {
  if (!user) return;
  
  // ... complex async logic ...
  
  (async () => {
    await refreshRole();  // ← Can trigger re-render
    // ... more state updates ...
    navigate(`/${roleData.role}`);  // ← Navigation might not happen
  })();
  
}, [user, navigate, refreshRole]);  // ← refreshRole changes on every render!
```

**Issues:**
1. **Unstable dependency:** `refreshRole` is not memoized
2. **Potential loop:** State updates → re-render → useEffect → state updates
3. **Race conditions:** Multiple async operations
4. **Navigation failures:** Can get stuck in loop

**Scenario:**
```
1. user changes → useEffect runs
2. refreshRole() called → updates role state
3. role update triggers parent re-render
4. useEffect runs again (user still same)
5. Infinite loop!
```

**Fix:**
```typescript
// In useAuth.tsx - memoize callbacks
const refreshRole = useCallback(async () => {
  if (user?.id) {
    await fetchUserRole(user.id);
  }
}, [user?.id]);

const refreshUser = useCallback(async () => {
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    setUser(data.user);
    await fetchUserRole(data.user.id);
    await fetchUserProfile(data.user.id);
  }
}, []);

// In Auth.tsx - use ref to track if effect ran
const hasInitialized = useRef(false);

useEffect(() => {
  if (!user || hasInitialized.current) return;
  hasInitialized.current = true;
  
  // ... rest of logic
}, [user]);  // Only depend on user
```

---

## 🟡 MEDIUM SEVERITY BUGS

### BUG #7: Memory Leak in TextContent Timer
**Severity:** 🟡 MEDIUM  
**Location:** `src/components/content/TextContent.tsx:76-88`  
**Risk:** Memory leak, performance degradation

**Problem:**
```typescript
useEffect(() => {
  let interval: NodeJS.Timeout;

  if (!isCompleted && !document.hidden) {
    interval = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 1000);
  }

  return () => {
    if (interval) clearInterval(interval);
  };
}, [isCompleted]);  // ← Missing document.hidden dependency!
```

**Issues:**
1. **Stale closure:** `document.hidden` checked once, never updates
2. **Timer keeps running:** Even when tab is hidden
3. **Memory leak:** Interval not cleared when visibility changes
4. **Battery drain:** Unnecessary CPU usage

**Scenario:**
```
1. User opens content → timer starts
2. User switches tab → document.hidden = true
3. Timer STILL RUNS (checked once in useEffect)
4. User leaves tab open for hours → wasted resources
```

**Fix:**
```typescript
useEffect(() => {
  let interval: NodeJS.Timeout | null = null;

  const startTimer = () => {
    if (interval) return;  // Already running
    interval = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      stopTimer();
    } else if (!isCompleted) {
      startTimer();
    }
  };

  // Start timer if conditions met
  if (!isCompleted && !document.hidden) {
    startTimer();
  }

  // Listen for visibility changes
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    stopTimer();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [isCompleted]);
```

---

### BUG #8: Uncaught Promise Rejection in Meeting Cancellation
**Severity:** 🟡 MEDIUM  
**Location:** `src/lib/meetingUtils.ts:125-168`  
**Risk:** Silent failures, inconsistent state

**Problem:**
```typescript
static async cancelMeeting(meetingId: string): Promise<void> {
  // ...
  
  try {
    if (existingMeeting.calendar_event_id) {
      try {
        await googleCalendarService.deleteEvent('primary', existingMeeting.calendar_event_id);
      } catch (calendarError: any) {
        console.warn('Calendar deletion failed, but continuing with database update:', calendarError);
        // ← Swallows error, but doesn't notify user!
      }
    }
    
    // Database update happens even if calendar delete failed
    const { error } = await supabase
      .from('meetings')
      .update({ status: 'cancelled' })
      .eq('id', meetingId);
  } catch (error) {
    console.error('Failed to cancel meeting:', error);
    throw error;  // ← But what if only calendar failed?
  }
}
```

**Issues:**
1. **Inconsistent state:** Calendar event exists, DB says cancelled
2. **Silent failure:** User not notified of partial failure
3. **No retry:** Calendar delete failure is permanent
4. **Poor UX:** Meeting shows as cancelled but still in calendar

**Fix:**
```typescript
static async cancelMeeting(meetingId: string): Promise<{
  success: boolean;
  calendarDeleted: boolean;
  dbUpdated: boolean;
  error?: string;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data: existingMeeting, error: fetchError } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', meetingId)
    .single();

  if (fetchError || !existingMeeting) {
    throw new Error('Meeting not found');
  }

  let calendarDeleted = false;
  let dbUpdated = false;
  let calendarError: Error | null = null;

  // Try to delete from calendar
  if (existingMeeting.calendar_event_id) {
    try {
      await googleCalendarService.deleteEvent('primary', existingMeeting.calendar_event_id);
      calendarDeleted = true;
    } catch (error: any) {
      calendarError = error;
      console.warn('Calendar deletion failed:', error);
    }
  }

  // Always update database status
  try {
    const { error } = await supabase
      .from('meetings')
      .update({ 
        status: 'cancelled',
        // Store partial failure info
        metadata: {
          calendar_deletion_failed: !calendarDeleted && !!existingMeeting.calendar_event_id,
          calendar_error: calendarError?.message,
        }
      })
      .eq('id', meetingId);

    if (error) throw error;
    dbUpdated = true;
  } catch (error: any) {
    throw new Error(`Failed to update database: ${error.message}`);
  }

  // Log analytics
  await this.logAnalyticsEvent(meetingId, user.id, 'meeting_cancelled', {
    calendar_deleted: calendarDeleted,
    partial_failure: !calendarDeleted && !!existingMeeting.calendar_event_id,
  });

  return {
    success: dbUpdated,
    calendarDeleted,
    dbUpdated,
    error: calendarError?.message,
  };
}
```

---

### BUG #9: No Pagination on Credit Transactions
**Severity:** 🟡 MEDIUM  
**Location:** `src/hooks/useCredits.ts:85-99`  
**Risk:** Performance degradation, memory issues

**Problem:**
```typescript
const { data: transactions, isLoading: transactionsLoading } = useQuery({
  queryKey: ["credit_transactions", user?.id],
  enabled: !!user?.id,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("credit_transactions")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(50);  // ← Hardcoded limit, no pagination!

    if (error) throw error;
    return data;
  },
});
```

**Issues:**
1. **Hardcoded limit:** Always fetches 50, can't load more
2. **No pagination:** Can't see older transactions
3. **Memory waste:** Fetches all 50 even if showing 10
4. **Poor UX:** User can't access full history

**Scenario:**
```
User has 500 transactions
- Only sees latest 50
- Can't view transaction #51-500
- No "Load More" button
- No way to search old transactions
```

**Fix:**
```typescript
export function useCredits(options: { transactionLimit?: number } = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [transactionPage, setTransactionPage] = useState(0);
  const pageSize = options.transactionLimit || 20;

  // Fetch transactions with pagination
  const { 
    data: transactionsData, 
    isLoading: transactionsLoading,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["credit_transactions", user?.id],
    enabled: !!user?.id,
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error, count } = await supabase
        .from("credit_transactions")
        .select("*", { count: 'exact' })
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .range(pageParam * pageSize, (pageParam + 1) * pageSize - 1);

      if (error) throw error;
      return { data, count, page: pageParam };
    },
    getNextPageParam: (lastPage, pages) => {
      const totalFetched = pages.reduce((sum, p) => sum + (p.data?.length || 0), 0);
      if (lastPage.count && totalFetched < lastPage.count) {
        return pages.length;
      }
      return undefined;
    },
  });

  const transactions = transactionsData?.pages.flatMap(p => p.data) || [];

  return {
    // ... other returns
    transactions,
    transactionsLoading,
    hasMoreTransactions: hasNextPage,
    loadMoreTransactions: fetchNextPage,
  };
}
```

---

### BUG #10: Missing Input Sanitization in Auth
**Severity:** 🟡 MEDIUM  
**Location:** `src/pages/Auth.tsx:169-181`  
**Risk:** XSS, data corruption

**Problem:**
```typescript
// Sanitize full name
const sanitizedFullName = fullName.trim().replace(/[<>]/g, '');
if (sanitizedFullName !== fullName.trim()) {
  toast.error("Full name contains invalid characters.");
  setLoading(false);
  return;
}
```

**Issues:**
1. **Incomplete sanitization:** Only removes `<` and `>`
2. **Allows other dangerous chars:** `'`, `"`, `;`, etc.
3. **No unicode normalization:** Can bypass with unicode lookalikes
4. **No length validation:** Can submit 10,000 character name

**Attack Vectors:**
```typescript
// These all bypass current sanitization:
fullName = "Robert'); DROP TABLE users; --"
fullName = "Jane\x00Doe"  // Null byte injection
fullName = "A".repeat(10000)  // DoS
fullName = "𝓙𝓸𝓱𝓷"  // Unicode that looks like "John"
```

**Fix:**
```typescript
const sanitizeFullName = (name: string): string => {
  return name
    .trim()
    .normalize('NFKC')  // Unicode normalization
    .replace(/[^\p{L}\p{M}\s'-]/gu, '')  // Only letters, marks, spaces, hyphens, apostrophes
    .replace(/\s+/g, ' ')  // Collapse multiple spaces
    .slice(0, 100);  // Max length
};

const validateFullName = (name: string): boolean => {
  if (name.length < 2 || name.length > 100) return false;
  if (!/^[\p{L}\p{M}\s'-]+$/u.test(name)) return false;
  if (/^\s|\s$/.test(name)) return false;  // No leading/trailing spaces
  return true;
};

// In form submission:
const sanitizedFullName = sanitizeFullName(fullName);
if (!validateFullName(sanitizedFullName)) {
  toast.error("Please enter a valid full name (2-100 characters, letters only).");
  setLoading(false);
  return;
}
```

---

## 🟢 LOW SEVERITY BUGS

### BUG #11: Console Logs in Production
**Severity:** 🟢 LOW  
**Location:** Multiple files  
**Risk:** Information disclosure, performance

**Problem:**
```typescript
// useAuth.tsx
console.log("✅ Successfully fetched role:", data.role);
console.warn("⚠️ No role data found for user:", userId);
console.error("❌ Exception while fetching role:", err);

// TextContent.tsx
console.log('Tab visible - resuming time tracking');
console.log('Tab hidden - pausing time tracking');

// meetingUtils.ts
console.log('Meeting creation details:', { ... });
```

**Issues:**
1. **Information disclosure:** Logs may contain sensitive data
2. **Performance:** Console.log has overhead
3. **Debugging artifacts:** Should not be in production
4. **Professionalism:** Looks unfinished

**Fix:**
Already partially fixed by Vite config (drops console in production), but should use proper logging:

```typescript
// Create logger utility (already exists at src/lib/logger.ts)
import { logger } from '@/lib/logger';

// Replace all console.log with:
logger.log('Successfully fetched role:', data.role);
logger.warn('No role data found for user:', userId);
logger.error('Exception while fetching role:', err);
```

---

### BUG #12: Missing Loading States
**Severity:** 🟢 LOW  
**Location:** `src/components/ProtectedRoute.tsx:14`  
**Risk:** Poor UX

**Problem:**
```typescript
if (loading || (user && role === null)) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
```

**Issues:**
1. **Generic message:** Doesn't tell user what's loading
2. **No timeout:** Could spin forever if auth fails
3. **No error state:** If auth fails, just spins
4. **Accessibility:** No aria-label

**Fix:**
```typescript
const [loadingTimeout, setLoadingTimeout] = useState(false);

useEffect(() => {
  const timer = setTimeout(() => {
    if (loading) {
      setLoadingTimeout(true);
    }
  }, 10000);  // 10 second timeout
  
  return () => clearTimeout(timer);
}, [loading]);

if (loading || (user && role === null)) {
  if (loadingTimeout) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-lg mb-4">Authentication is taking longer than expected</p>
        <Button onClick={() => window.location.reload()}>
          Reload Page
        </Button>
      </div>
    );
  }
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <div 
          className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"
          role="status"
          aria-label="Loading authentication"
        ></div>
        <p className="mt-4 text-muted-foreground">Verifying your access...</p>
      </div>
    </div>
  );
}
```

---

## 📊 Bug Summary

| Severity | Count | Fixed | Remaining |
|----------|-------|-------|-----------|
| 🔴 Critical | 3 | 0 | 3 |
| 🟠 High | 3 | 0 | 3 |
| 🟡 Medium | 5 | 0 | 5 |
| 🟢 Low | 2 | 0 | 2 |
| **Total** | **13** | **0** | **13** |

---

## 🎯 Recommended Fix Priority

### Immediate (This Week)
1. **BUG #1** - Hardcoded Supabase URL
2. **BUG #3** - Race condition in auth
3. **BUG #4** - Missing error boundaries

### High Priority (Next Week)
4. **BUG #2** - XSS vulnerability (add DOMPurify)
5. **BUG #5** - Input validation in meetings
6. **BUG #6** - Infinite loop risk

### Medium Priority (This Month)
7. **BUG #7** - Memory leak in timer
8. **BUG #8** - Promise rejection handling
9. **BUG #9** - Pagination for transactions
10. **BUG #10** - Input sanitization

### Low Priority (When Time Permits)
11. **BUG #11** - Console logs (already mitigated)
12. **BUG #12** - Loading states

---

## 🧪 Testing Recommendations

After fixes, test:
- [ ] Auth flow with slow network
- [ ] Meeting creation with invalid input
- [ ] XSS payloads in text content
- [ ] Chunk loading failures
- [ ] Race conditions (rapid navigation)
- [ ] Memory leaks (leave tab open 1 hour)
- [ ] Transaction pagination with 100+ items
- [ ] Environment variable switching

---

## 📚 Additional Resources

- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)

---

**Next Steps:** Begin with critical bugs #1, #3, #4 immediately.
