# Stuck Withdrawals Fix - Implementation Guide

## Problem Statement

Some withdrawals were remaining in "Processing" status indefinitely, even after the payment provider (PayChangu) had completed or failed the transaction. This occurred because:

1. The system initiated a withdrawal and marked it as "processing"
2. PayChangu processed the transaction and returned a final status
3. However, there was no mechanism to check the final status and update the database
4. Result: Withdrawals remained stuck in "processing" forever

## Solution Overview

The solution implements an automatic status checking mechanism with three components:

### 1. **Edge Function: `check-pending-withdrawals`**
   - Runs periodically (via cron job or manual trigger)
   - Queries all withdrawals in "processing" status
   - Checks their status with PayChangu API
   - Updates the database with final status

### 2. **Edge Function: `check-withdrawal-status`**
   - Called manually by users or the UI
   - Checks a single withdrawal's status with PayChangu
   - Updates the database if a final status is found
   - Returns the updated status to the client

### 3. **UI Enhancement**
   - Added "Check Status" button for processing withdrawals
   - Allows users to manually check status
   - Shows loading state while checking
   - Displays success/failure messages

### 4. **Database Improvements**
   - Added indexes for better query performance
   - Created helper function to mark old processing withdrawals
   - Created view to identify stuck withdrawals

## Implementation Details

### Files Created/Modified

#### New Files:
1. `supabase/functions/check-pending-withdrawals/index.ts`
   - Automatic background checker
   - Processes up to 50 withdrawals per run
   - Only checks withdrawals older than 5 minutes
   - Logs detailed information for debugging

2. `supabase/functions/check-withdrawal-status/index.ts`
   - Manual status checker
   - Called from the UI
   - Single withdrawal focus
   - Returns detailed status information

3. `supabase/migrations/20251111_fix_stuck_withdrawals.sql`
   - Database improvements
   - Indexes for performance
   - Helper function and view

#### Modified Files:
1. `src/pages/coach/Withdrawals.tsx`
   - Added `handleCheckWithdrawalStatus` function
   - Added "Check Status" button for processing withdrawals
   - Added state management for checking status
   - Integrated with React Query for cache invalidation

## How It Works

### Automatic Status Checking (Background)

```
1. check-pending-withdrawals function runs periodically
2. Fetches all withdrawals with status = 'processing' and created_at < 5 minutes ago
3. For each withdrawal:
   a. Skips if no payout_trans_id
   b. Calls PayChangu API: GET /mobile-money/payouts/status/{trans_id}
   c. Checks response status:
      - "success"/"completed" → marks as "completed"
      - "failed"/"rejected"/"cancelled" → marks as "failed" with reason
      - "pending"/"processing" → leaves as is
      - unknown → logs and skips
   d. Updates database with new status
4. Returns results with count and details
```

### Manual Status Checking (User-Initiated)

```
1. User clicks "Check Status" button on processing withdrawal
2. Frontend calls check-withdrawal-status Edge Function
3. Function:
   a. Validates withdrawal exists and is in "processing" status
   b. Calls PayChangu API to get current status
   c. Updates database if final status found
   d. Returns result to frontend
4. Frontend:
   a. Shows success/info toast
   b. Invalidates React Query cache
   c. Refreshes withdrawal list
```

### PayChangu Status Mapping

| PayChangu Status | Action | Result |
|---|---|---|
| `success` | Mark as completed | User receives funds |
| `completed` | Mark as completed | User receives funds |
| `failed` | Mark as failed | Credits refunded |
| `rejected` | Mark as failed | Credits refunded |
| `cancelled` | Mark as failed | Credits refunded |
| `pending` | No action | Keep checking |
| `processing` | No action | Keep checking |

## Deployment Instructions

### 1. Deploy Edge Functions

```bash
# Deploy check-pending-withdrawals
supabase functions deploy check-pending-withdrawals --project-ref your-project-ref

# Deploy check-withdrawal-status
supabase functions deploy check-withdrawal-status --project-ref your-project-ref
```

### 2. Run Database Migration

```bash
# Apply the migration
supabase db push --project-ref your-project-ref
```

### 3. Set Up Cron Job (Optional but Recommended)

For automatic background checking, set up a cron job to call `check-pending-withdrawals` every 5-10 minutes:

**Option A: GitHub Actions**
```yaml
name: Check Pending Withdrawals
on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: Check pending withdrawals
        run: |
          curl -X POST \
            https://<your-project>.supabase.co/functions/v1/check-pending-withdrawals \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}" \
            -H "Content-Type: application/json"
```

**Option B: External Service (e.g., EasyCron, Zapier)**
- Create a POST request to your Edge Function
- Set interval to 5-10 minutes
- Add Authorization header with service role key

**Option C: Supabase Cron (if available)**
- Use Supabase's native cron functionality
- Configure to run every 5-10 minutes

### 4. Test the Implementation

```bash
# Test manual status check
curl -X POST \
  https://<your-project>.supabase.co/functions/v1/check-withdrawal-status \
  -H "Authorization: Bearer ${{ SUPABASE_SERVICE_KEY }}" \
  -H "Content-Type: application/json" \
  -d '{"withdrawalId": "your-withdrawal-id"}'

# Test automatic checker
curl -X POST \
  https://<your-project>.supabase.co/functions/v1/check-pending-withdrawals \
  -H "Authorization: Bearer ${{ SUPABASE_SERVICE_KEY }}" \
  -H "Content-Type: application/json"
```

## Monitoring & Troubleshooting

### View Stuck Withdrawals

```sql
-- Check for stuck withdrawals
SELECT * FROM stuck_withdrawals;

-- Count by status
SELECT status, COUNT(*) as count
FROM withdrawal_requests
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

### Check Function Logs

```bash
# View check-pending-withdrawals logs
supabase functions logs check-pending-withdrawals --project-ref your-project-ref

# View check-withdrawal-status logs
supabase functions logs check-withdrawal-status --project-ref your-project-ref
```

### Manual Fix for Stuck Withdrawals

If a withdrawal is still stuck after implementation:

```sql
-- Mark as pending for retry
UPDATE withdrawal_requests
SET status = 'pending'
WHERE id = 'withdrawal-id' AND status = 'processing';

-- Or mark as failed if it's been processing for too long
UPDATE withdrawal_requests
SET status = 'failed',
    failure_reason = 'Stuck in processing for 24+ hours'
WHERE id = 'withdrawal-id' 
  AND status = 'processing'
  AND created_at < NOW() - INTERVAL '24 hours';
```

## Performance Considerations

### Indexes Added
- `idx_withdrawal_requests_status_created_at` - Speeds up status queries
- `idx_withdrawal_requests_payout_trans_id` - Speeds up transaction ID lookups

### Query Optimization
- Only processes withdrawals older than 5 minutes (avoids race conditions)
- Processes in batches of 50 (prevents timeout)
- Skips withdrawals without transaction IDs

### Rate Limiting
- PayChangu API calls are rate-limited
- Background checker processes max 50 per run
- Manual checks are user-initiated (no automatic rate limit)

## Future Enhancements

1. **Webhook Integration**: Receive status updates directly from PayChangu
2. **Automatic Refunds**: Automatically refund credits for failed withdrawals
3. **User Notifications**: Email/SMS notifications when status changes
4. **Analytics**: Track success rates and processing times
5. **Admin Dashboard**: Real-time view of withdrawal statuses

## Rollback Instructions

If issues occur:

```bash
# Disable the Edge Functions
supabase functions delete check-pending-withdrawals --project-ref your-project-ref
supabase functions delete check-withdrawal-status --project-ref your-project-ref

# Revert the migration
supabase db reset --project-ref your-project-ref
```

## Support & Debugging

### Common Issues

**Issue: "No transaction ID found"**
- Cause: Withdrawal was created but payout never initiated
- Fix: Mark as failed and refund credits

**Issue: "PayChangu API error 401"**
- Cause: Invalid or expired API key
- Fix: Verify `PAYCHANGU_SECRET_KEY` environment variable

**Issue: "Withdrawal not found"**
- Cause: Invalid withdrawal ID
- Fix: Verify the withdrawal ID exists in the database

### Logs to Check

1. Supabase Edge Function logs
2. PayChangu API response logs
3. Database update logs
4. Frontend console logs

## Testing Checklist

- [ ] Deploy both Edge Functions
- [ ] Run database migration
- [ ] Test manual status check on a processing withdrawal
- [ ] Verify UI "Check Status" button works
- [ ] Set up cron job for automatic checking
- [ ] Monitor logs for errors
- [ ] Test with a real withdrawal (if possible)
- [ ] Verify status updates in database
- [ ] Check that users receive notifications

## Summary

This implementation provides a robust solution for handling stuck withdrawals by:

1. **Automatically checking** pending withdrawals in the background
2. **Allowing manual checks** for users who want immediate status updates
3. **Updating the database** with final statuses from PayChangu
4. **Providing visibility** through the UI and database views
5. **Improving performance** with proper indexing

The system is designed to be resilient, with proper error handling and logging for debugging.
