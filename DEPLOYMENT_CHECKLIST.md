# Stuck Withdrawals Fix - Deployment Checklist

## Pre-Deployment

- [ ] Review `IMPLEMENTATION_SUMMARY_STUCK_WITHDRAWALS.md`
- [ ] Review `docs/STUCK_WITHDRAWALS_FIX.md`
- [ ] Ensure you have Supabase CLI installed: `supabase --version`
- [ ] Ensure you have access to your Supabase project
- [ ] Have your `SUPABASE_SERVICE_KEY` ready for cron job setup

## Deployment Phase 1: Edge Functions (5 minutes)

### Deploy check-pending-withdrawals
```bash
cd c:\Users\MrNgwira\Desktop\Rueben\ Fandika\expert-coaching-hub
supabase functions deploy check-pending-withdrawals --project-ref your-project-ref
```
- [ ] Command executed successfully
- [ ] No errors in output
- [ ] Function appears in Supabase dashboard

### Deploy check-withdrawal-status
```bash
supabase functions deploy check-withdrawal-status --project-ref your-project-ref
```
- [ ] Command executed successfully
- [ ] No errors in output
- [ ] Function appears in Supabase dashboard

### Verify Functions
```bash
supabase functions list --project-ref your-project-ref
```
- [ ] Both functions listed
- [ ] Status shows as "Active"

## Deployment Phase 2: Database Migration (2 minutes)

### Run Migration
```bash
supabase db push --project-ref your-project-ref
```
- [ ] Command executed successfully
- [ ] No errors in output
- [ ] Migration applied

### Verify Migration
```bash
# Check if indexes exist
supabase sql query "SELECT indexname FROM pg_indexes WHERE tablename='withdrawal_requests';" --project-ref your-project-ref
```
- [ ] `idx_withdrawal_requests_status_created_at` exists
- [ ] `idx_withdrawal_requests_payout_trans_id` exists

### Verify View
```bash
supabase sql query "SELECT * FROM stuck_withdrawals LIMIT 1;" --project-ref your-project-ref
```
- [ ] View exists and returns data (or empty if no stuck withdrawals)

## Deployment Phase 3: UI Testing (3 minutes)

### Start Development Server
```bash
npm run dev
# or
yarn dev
```
- [ ] Development server starts without errors
- [ ] No TypeScript errors in console

### Test Manual Status Check
1. [ ] Navigate to Withdrawals page
2. [ ] Find a withdrawal with "Processing" status
3. [ ] Click "Check Status" button
4. [ ] Button shows loading state
5. [ ] Toast message appears (success or info)
6. [ ] No errors in browser console

### Test UI Elements
- [ ] "Check Status" button is visible for processing withdrawals
- [ ] Button is disabled while checking
- [ ] Loading spinner shows while checking
- [ ] Button re-enables after check completes

## Deployment Phase 4: Cron Job Setup (5 minutes)

### Choose One Option:

#### Option A: GitHub Actions (Recommended)
1. [ ] Create `.github/workflows/check-withdrawals.yml`
2. [ ] Add cron schedule: `'*/5 * * * *'` (every 5 minutes)
3. [ ] Add `SUPABASE_SERVICE_KEY` to GitHub Secrets
4. [ ] Commit and push
5. [ ] Verify workflow appears in Actions tab
6. [ ] Wait for first scheduled run

#### Option B: EasyCron
1. [ ] Go to https://www.easycron.com
2. [ ] Create new cron job
3. [ ] URL: `https://<your-project>.supabase.co/functions/v1/check-pending-withdrawals`
4. [ ] Method: POST
5. [ ] Add header: `Authorization: Bearer <SUPABASE_SERVICE_KEY>`
6. [ ] Cron expression: `*/5 * * * *` (every 5 minutes)
7. [ ] Save and test

#### Option C: Zapier
1. [ ] Create new Zap
2. [ ] Trigger: Schedule
3. [ ] Action: Webhooks by Zapier (POST)
4. [ ] URL: `https://<your-project>.supabase.co/functions/v1/check-pending-withdrawals`
5. [ ] Headers: `Authorization: Bearer <SUPABASE_SERVICE_KEY>`
6. [ ] Schedule: Every 5 minutes
7. [ ] Test and activate

- [ ] Cron job configured
- [ ] Cron job tested manually
- [ ] Cron job scheduled

## Post-Deployment Verification (10 minutes)

### Check Function Logs
```bash
supabase functions logs check-pending-withdrawals --project-ref your-project-ref --limit 10
supabase functions logs check-withdrawal-status --project-ref your-project-ref --limit 10
```
- [ ] No error messages in logs
- [ ] Logs show expected operations

### Monitor Stuck Withdrawals
```bash
supabase sql query "SELECT COUNT(*) as stuck_count FROM stuck_withdrawals;" --project-ref your-project-ref
```
- [ ] Query executes successfully
- [ ] Note the count for future comparison

### Test Manual Check Again
1. [ ] Go to Withdrawals page
2. [ ] Click "Check Status" on a processing withdrawal
3. [ ] Verify it works
4. [ ] Check browser console for errors

### Verify Automatic Checking (if cron job set up)
1. [ ] Wait 5-10 minutes
2. [ ] Check function logs again
3. [ ] Verify `check-pending-withdrawals` was called
4. [ ] Check for any errors

## Production Monitoring (Ongoing)

### Daily Checks
- [ ] Check stuck withdrawals count: `SELECT COUNT(*) FROM stuck_withdrawals;`
- [ ] Review Edge Function logs for errors
- [ ] Monitor cron job execution (if applicable)

### Weekly Checks
- [ ] Review withdrawal success rates
- [ ] Check for any patterns in failures
- [ ] Verify indexes are being used (query performance)

### Monthly Checks
- [ ] Review overall system performance
- [ ] Check for any recurring issues
- [ ] Update documentation if needed

## Troubleshooting

### If "Check Status" button doesn't work:
1. [ ] Verify both Edge Functions are deployed: `supabase functions list`
2. [ ] Check browser console for errors (F12)
3. [ ] Verify `VITE_SUPABASE_URL` is set in `.env`
4. [ ] Check Edge Function logs: `supabase functions logs check-withdrawal-status`

### If status doesn't update:
1. [ ] Verify withdrawal has `payout_trans_id`: `SELECT * FROM withdrawal_requests WHERE id='...'`
2. [ ] Check PayChangu API key is correct
3. [ ] Test PayChangu API manually
4. [ ] Check Edge Function logs for errors

### If cron job doesn't run:
1. [ ] Verify cron job configuration
2. [ ] Test cron job manually with curl
3. [ ] Check cron service logs
4. [ ] Verify authorization header has correct API key

## Rollback Plan

If critical issues occur:

```bash
# Step 1: Delete Edge Functions
supabase functions delete check-pending-withdrawals --project-ref your-project-ref
supabase functions delete check-withdrawal-status --project-ref your-project-ref

# Step 2: Revert UI changes
git checkout src/pages/coach/Withdrawals.tsx

# Step 3: Restart development server
npm run dev

# Step 4: (Optional) Revert database
supabase db reset --project-ref your-project-ref
```

- [ ] Rollback completed if needed
- [ ] System back to previous state
- [ ] No errors after rollback

## Sign-Off

- [ ] All deployment phases completed
- [ ] All verification checks passed
- [ ] Cron job configured and tested
- [ ] Documentation reviewed
- [ ] Team notified of changes
- [ ] Ready for production use

**Deployment Date:** _______________
**Deployed By:** _______________
**Verified By:** _______________

## Next Steps

1. Monitor the system for 24 hours
2. Review logs daily for first week
3. Set up alerts for Edge Function errors
4. Plan for webhook integration (future enhancement)
5. Document any issues encountered

## Support

For questions or issues:
1. Check `docs/STUCK_WITHDRAWALS_FIX.md`
2. Check `STUCK_WITHDRAWALS_DEPLOYMENT.md`
3. Review Edge Function logs
4. Check database for stuck withdrawals
5. Contact Supabase support if needed
