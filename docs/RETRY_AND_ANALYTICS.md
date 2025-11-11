# Retry Mechanism & Comparative Analytics

## Overview
This document details the implementation of retry limits for failed withdrawals and comparative analytics for tracking withdrawal performance over time.

---

## 🔄 Part 1: Retry Mechanism with Limits

### Features

#### 1. **3-Retry Limit per Withdrawal**
- Coaches can retry failed withdrawals up to 3 times
- After 3 retries, manual support intervention is required
- Retry count is tracked in the database

#### 2. **Automatic Retry Tracking**
- Each retry is logged with a reference to the original withdrawal
- Retry count increments with each attempt
- Last retry timestamp is recorded

#### 3. **User-Friendly UI**
- Retry button shows remaining attempts: "Retry Withdrawal (2 left)"
- Button is disabled when max retries reached
- Clear messaging about retry limits

### Database Schema

**New Fields in `withdrawal_requests` table:**
```sql
ALTER TABLE withdrawal_requests
ADD COLUMN retry_count INTEGER DEFAULT 0,
ADD COLUMN original_withdrawal_id UUID REFERENCES withdrawal_requests(id),
ADD COLUMN last_retry_at TIMESTAMPTZ;
```

**Indexes:**
```sql
CREATE INDEX idx_withdrawal_requests_original_id 
ON withdrawal_requests(original_withdrawal_id) 
WHERE original_withdrawal_id IS NOT NULL;
```

### Implementation Details

#### Backend Logic (`useCredits.ts`)

```typescript
const retryWithdrawal = useMutation({
  mutationFn: async (withdrawalRequestId: string) => {
    // 1. Fetch original withdrawal request
    const originalRequest = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("id", withdrawalRequestId)
      .single();

    // 2. Check retry limit (max 3)
    const retryCount = originalRequest.retry_count || 0;
    if (retryCount >= 3) {
      throw new Error("Maximum retry limit (3) reached");
    }

    // 3. Count existing retries
    const existingRetries = await supabase
      .from("withdrawal_requests")
      .select("id")
      .eq("original_withdrawal_id", withdrawalRequestId);

    const totalRetries = (existingRetries?.length || 0) + retryCount;
    if (totalRetries >= 3) {
      throw new Error("Maximum retry limit (3) reached");
    }

    // 4. Update retry tracking
    await supabase
      .from("withdrawal_requests")
      .update({
        retry_count: retryCount + 1,
        last_retry_at: new Date().toISOString(),
      })
      .eq("id", withdrawalRequestId);

    // 5. Resubmit withdrawal with same parameters
    return callSupabaseFunction("immediate-withdrawal", {
      credits_amount: originalRequest.credits_amount,
      payment_method: originalRequest.payment_method,
      payment_details: originalRequest.payment_details,
      notes: `Retry ${retryCount + 1}/3 of withdrawal ${withdrawalRequestId}`,
      original_withdrawal_id: withdrawalRequestId,
    });
  },
});
```

#### Frontend UI (`Withdrawals.tsx`)

**Failed Withdrawal Card:**
```
⚠️ Credits have been automatically refunded to your wallet
You can retry your withdrawal or contact support...

Retries: 1/3

[🔄 Retry Withdrawal (2 left)]
```

**When Max Retries Reached:**
```
⚠️ Credits have been automatically refunded to your wallet
Maximum retry limit reached. Please contact support for assistance.

Retries: 3/3

(No retry button shown)
```

### User Experience Flow

1. **First Failure:**
   - Withdrawal fails
   - Credits automatically refunded
   - Retry button shows: "Retry Withdrawal"
   - Retry count: 0/3

2. **After 1st Retry:**
   - If fails again, credits refunded
   - Retry button shows: "Retry Withdrawal (2 left)"
   - Retry count: 1/3

3. **After 2nd Retry:**
   - If fails again, credits refunded
   - Retry button shows: "Retry Withdrawal (1 left)"
   - Retry count: 2/3

4. **After 3rd Retry:**
   - If fails, credits refunded
   - Retry button is hidden
   - Message: "Maximum retry limit reached"
   - Retry count: 3/3
   - User must contact support

### Benefits

✅ **Reduces Support Tickets** - Users can self-resolve transient failures
✅ **Better UX** - No need to re-enter payment details
✅ **Prevents Abuse** - 3-retry limit prevents infinite loops
✅ **Audit Trail** - All retries tracked with timestamps
✅ **Clear Feedback** - Users know exactly how many retries remain

---

## 📊 Part 2: Comparative Analytics

### Features

#### 1. **Period Selector**
Users can compare analytics across different time periods:
- Last 7 Days
- Last 30 Days
- Last 90 Days

#### 2. **Automatic Period Comparison**
For each selected period, the system automatically compares with the previous period of the same duration:
- Current 7 days vs Previous 7 days
- Current 30 days vs Previous 30 days
- Current 90 days vs Previous 90 days

#### 3. **Comparison Indicators**
Each metric displays:
- **Current Value** - Large, bold number
- **Change Icon** - ⬆️ (improvement), ⬇️ (decline), ➡️ (no change)
- **Percentage Change** - Shows % increase/decrease
- **Color Coding** - Green (good), Red (bad), Gray (neutral)

### Metrics Compared

| Metric | Calculation | Good Direction |
|--------|-------------|-----------------|
| **Success Rate** | Completed / (Completed + Failed + Rejected) | ⬆️ Up |
| **Processing Time** | Avg time from creation to completion | ⬇️ Down |
| **Total Withdrawn** | Sum of completed withdrawal amounts | ⬆️ Up |
| **Total Requests** | Count of all withdrawal requests | ⬆️ Up |

### Implementation Details

#### Period Calculation Logic

```typescript
const getPeriodDays = (period: Period): number => {
  switch (period) {
    case "7d": return 7;
    case "30d": return 30;
    case "90d": return 90;
  }
};

// Current period: Last X days
const currentPeriodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
const currentPeriodEnd = now;

// Previous period: X days before current period
const previousPeriodStart = new Date(currentPeriodStart.getTime() - periodDays * 24 * 60 * 60 * 1000);
const previousPeriodEnd = currentPeriodStart;
```

#### Metrics Calculation

```typescript
const calculatePeriodMetrics = (withdrawals: any[], startDate: Date, endDate: Date) => {
  const periodWithdrawals = withdrawals.filter(w => {
    const createdAt = new Date(w.created_at);
    return createdAt >= startDate && createdAt < endDate;
  });

  // Calculate all metrics for this period
  const successRate = /* ... */;
  const avgProcessingTime = /* ... */;
  const totalWithdrawn = /* ... */;
  const totalRequests = periodWithdrawals.length;

  return { successRate, avgProcessingTime, totalWithdrawn, totalRequests };
};

// Get both periods
const currentMetrics = calculatePeriodMetrics(allWithdrawals, currentPeriodStart, currentPeriodEnd);
const previousMetrics = calculatePeriodMetrics(allWithdrawals, previousPeriodStart, previousPeriodEnd);

// Calculate percentage changes
const successRateChange = ((currentMetrics.successRate - previousMetrics.successRate) / previousMetrics.successRate) * 100;
```

#### UI Components

**Period Selector:**
```
┌─────────────────────────────────────────────────────────┐
│ Analytics                      [Last 7 Days ▼]          │
│ Comparing current period with previous period            │
└─────────────────────────────────────────────────────────┘
```

**Metric Card with Comparison:**
```
┌──────────────────────────────────────┐
│ Success Rate                    %    │
├──────────────────────────────────────┤
│ 92.5%  ⬆️ 5.2%                       │
│ 23 of 25 processed                   │
└──────────────────────────────────────┘
```

**Color Coding:**
- ⬆️ Green (92.5% improvement) - Good trend
- ⬇️ Red (5.2% decline) - Bad trend
- ➡️ Gray (0% change) - Neutral

### Analytics Dashboard Integration

The analytics are integrated into the Coach Analytics page under the "Withdrawals" tab:

```
[Overview] [Students] [Financials] [Withdrawals]
                                        ↓
                        WithdrawalAnalytics Component
                                        ↓
                    Period Selector + Comparison Metrics
                                        ↓
                    Key Metrics with Trend Indicators
                                        ↓
                    Status Breakdown + Charts
```

### Example Scenarios

#### Scenario 1: Improving Performance
```
Period: Last 30 Days vs Previous 30 Days

Success Rate:    95.2% ⬆️ 8.3%  (was 87.8%)
Processing Time: 2.1m  ⬇️ 12.5% (was 2.4m)
Total Withdrawn: 450K  ⬆️ 15.2% (was 390K)
Total Requests:  48    ⬆️ 6.7%  (was 45)

✅ All metrics improving - System performing well!
```

#### Scenario 2: Declining Performance
```
Period: Last 7 Days vs Previous 7 Days

Success Rate:    78.5% ⬇️ 12.3% (was 89.6%)
Processing Time: 3.2m  ⬆️ 28.6% (was 2.5m)
Total Withdrawn: 85K   ⬇️ 22.1% (was 109K)
Total Requests:  14    ⬇️ 18.9% (was 17)

⚠️ Multiple metrics declining - Investigate issues
```

#### Scenario 3: Mixed Performance
```
Period: Last 90 Days vs Previous 90 Days

Success Rate:    88.3% ⬆️ 2.1%  (was 86.5%)
Processing Time: 2.4m  ⬇️ 5.8%  (was 2.5m)
Total Withdrawn: 1.2M  ⬆️ 18.5% (was 1.0M)
Total Requests:  142   ⬆️ 12.3% (was 126)

✅ Success and volume up, but processing time improved
```

### Benefits

✅ **Track Progress** - See if system is improving over time
✅ **Identify Trends** - Spot patterns and anomalies
✅ **Data-Driven Decisions** - Make informed improvements
✅ **Performance Monitoring** - Catch issues early
✅ **Flexible Periods** - Compare different time ranges
✅ **Visual Indicators** - Quick at-a-glance understanding

---

## 🔧 Technical Implementation

### Files Modified

1. **Database Migration**
   - File: `supabase/migrations/20251111071400_add_retry_tracking.sql`
   - Adds: `retry_count`, `original_withdrawal_id`, `last_retry_at` columns

2. **Hook**
   - File: `src/hooks/useCredits.ts`
   - Adds: `retryWithdrawal` mutation with 3-retry limit

3. **Edge Function**
   - File: `supabase/functions/immediate-withdrawal/index.ts`
   - Updates: Withdrawal request creation to include retry metadata

4. **Coach Withdrawals Page**
   - File: `src/pages/coach/Withdrawals.tsx`
   - Adds: Retry button with limit display

5. **Analytics Component**
   - File: `src/components/WithdrawalAnalytics.tsx`
   - Adds: Period selector and comparison metrics

6. **Coach Analytics Page**
   - File: `src/pages/coach/CoachAnalytics.tsx`
   - Adds: Withdrawals tab with analytics

### Database Queries

**Get retry count for a withdrawal:**
```sql
SELECT retry_count, last_retry_at 
FROM withdrawal_requests 
WHERE id = $1;
```

**Get all retries for a withdrawal:**
```sql
SELECT * 
FROM withdrawal_requests 
WHERE original_withdrawal_id = $1 
ORDER BY created_at DESC;
```

**Get withdrawals in a period:**
```sql
SELECT * 
FROM withdrawal_requests 
WHERE coach_id = $1 
  AND created_at >= $2 
  AND created_at < $3 
ORDER BY created_at DESC;
```

---

## 📈 Analytics Data Flow

```
Withdrawal Requests
        ↓
Filter by Coach & Period
        ↓
Calculate Metrics (Current Period)
        ↓
Calculate Metrics (Previous Period)
        ↓
Calculate % Changes
        ↓
Determine Trend Direction
        ↓
Display with Indicators
```

---

## 🧪 Testing Checklist

### Retry Mechanism
- [ ] Retry button appears on failed withdrawals
- [ ] Retry count displays correctly (0/3, 1/3, 2/3, 3/3)
- [ ] Button disabled after 3 retries
- [ ] Error message shown when max retries reached
- [ ] Retry notes include attempt number
- [ ] Original withdrawal ID tracked correctly
- [ ] Last retry timestamp updated

### Comparative Analytics
- [ ] Period selector works (7d, 30d, 90d)
- [ ] Metrics calculate correctly for current period
- [ ] Metrics calculate correctly for previous period
- [ ] Percentage changes calculated accurately
- [ ] Trend icons display correctly (⬆️ ⬇️ ➡️)
- [ ] Colors apply correctly (green/red/gray)
- [ ] Analytics update when period changes
- [ ] No data shows gracefully (0 withdrawals)

### Edge Cases
- [ ] First withdrawal (no previous period data)
- [ ] Period with no withdrawals
- [ ] Retry on already-retried withdrawal
- [ ] Concurrent retry attempts
- [ ] Analytics with partial period data

---

## 🚀 Deployment Notes

1. **Run Migration:**
   ```bash
   supabase db push --include-all
   ```

2. **Verify Fields:**
   - Check `withdrawal_requests` table has new columns
   - Verify indexes created

3. **Test Retry:**
   - Create failed withdrawal
   - Click retry button
   - Verify retry count increments

4. **Test Analytics:**
   - Navigate to Analytics > Withdrawals
   - Change period selector
   - Verify metrics update

---

## 📝 Summary

### Retry Mechanism
- ✅ Max 3 retries per withdrawal
- ✅ Automatic retry tracking
- ✅ User-friendly UI with remaining attempts
- ✅ Clear error messages at limit
- ✅ Reduces support burden

### Comparative Analytics
- ✅ 3 period options (7d, 30d, 90d)
- ✅ Automatic period comparison
- ✅ 4 key metrics tracked
- ✅ Visual trend indicators
- ✅ Color-coded performance
- ✅ Flexible and extensible

**Total Implementation:** ~500 lines of code across 6 files
**Database Changes:** 3 new columns + 1 index
**User-Facing Features:** 2 major enhancements
