# Stuck Withdrawals Fix - Quick Deployment Guide

## What Was Implemented

Fixed the issue where withdrawals were stuck in "Processing" status indefinitely by implementing automatic status checking with PayChangu.

## Files Created

1. **Edge Functions:**
   - `supabase/functions/check-pending-withdrawals/index.ts` - Background checker
   - `supabase/functions/check-withdrawal-status/index.ts` - Manual checker

2. **Database:**
   - `supabase/migrations/20251111_fix_stuck_withdrawals.sql` - Indexes and helpers

3. **UI:**
   - `src/pages/coach/Withdrawals.tsx` - Added "Check Status" button

4. **Documentation:**
   - `docs/STUCK_WITHDRAWALS_FIX.md` - Full implementation guide

## Quick Deployment (5 minutes)

### Step 1: Deploy Edge Functions

```bash
# Navigate to project root
cd c:\Users\MrNgwira\Desktop\Rueben\ Fandika\expert-coaching-hub

# Deploy both functions
supabase functions deploy check-pending-withdrawals --project-ref your-project-ref
supabase functions deploy check-withdrawal-status --project-ref your-project-ref
```

### Step 2: Run Database Migration

```bash
# Apply the migration
supabase db push --project-ref your-project-ref
```

### Step 3: Test Manual Status Check

1. Go to Withdrawals page
2. Find a withdrawal with "Processing" status
3. Click "Check Status" button
4. Status should update if PayChangu has a final result

### Step 4: Set Up Automatic Checking (Optional)

Choose one option:

**Option A: GitHub Actions (Recommended)**
Add to `.github/workflows/check-withdrawals.yml`:
```yaml
name: Check Pending Withdrawals
on:
  schedule:
    - cron: '*/5 * * * *'

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

**Option B: External Service**
- Use EasyCron, Zapier, or similar
- POST to: `https://<your-project>.supabase.co/functions/v1/check-pending-withdrawals`
- Add header: `Authorization: Bearer <SUPABASE_SERVICE_KEY>`
- Set interval: Every 5-10 minutes

## Verification

### Check if functions are deployed:
```bash
supabase functions list --project-ref your-project-ref
```

### Check if migration was applied:
```bash
# View stuck withdrawals
supabase sql query "SELECT * FROM stuck_withdrawals LIMIT 5;" --project-ref your-project-ref
```

### Check function logs:
```bash
supabase functions logs check-pending-withdrawals --project-ref your-project-ref
supabase functions logs check-withdrawal-status --project-ref your-project-ref
```

## What Happens Now

### For Users:
- Processing withdrawals show a "Check Status" button
- Users can manually check status anytime
- Status updates automatically if PayChangu has a result

### In Background (if cron job set up):
- Every 5-10 minutes, the system checks all processing withdrawals
- If PayChangu reports a final status, database is updated
- Users see the updated status next time they refresh

## Troubleshooting

**Q: "Check Status" button doesn't work**
- A: Make sure both Edge Functions are deployed
- Check browser console for errors
- Verify `VITE_SUPABASE_URL` is set correctly

**Q: Status still shows "Processing" after clicking**
- A: PayChangu might still be processing
- Try again in a few moments
- Check function logs for errors

**Q: Cron job not running**
- A: Verify the authorization header has correct API key
- Check that the URL is correct
- Test manually with curl first

## Rollback (if needed)

```bash
# Delete the Edge Functions
supabase functions delete check-pending-withdrawals --project-ref your-project-ref
supabase functions delete check-withdrawal-status --project-ref your-project-ref

# Revert UI changes (git)
git checkout src/pages/coach/Withdrawals.tsx

# Revert database (optional - keeps the indexes which don't hurt)
supabase db reset --project-ref your-project-ref
```

## Support

For detailed information, see: `docs/STUCK_WITHDRAWALS_FIX.md`

For issues:
1. Check Edge Function logs
2. Verify PayChangu API key is correct
3. Check database for stuck withdrawals: `SELECT * FROM stuck_withdrawals;`
4. Review browser console for client-side errors
