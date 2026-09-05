# Supabase Setup Checklist

## Project Information
- **Project ID**: vbrxgaxjmpwusbbbzzgl
- **Project URL**: https://vbrxgaxjmpwusbbbzzgl.supabase.co
- **Webhook Endpoint**: https://vbrxgaxjmpwusbbbzzgl.supabase.co/functions/v1/paychangu-webhook

## Required Environment Variables in Supabase

These must be set in your Supabase project's Edge Function environment variables, NOT in .env files.

### For Payment Webhooks
```
PAYCHANGU_WEBHOOK_SECRET=<your_paychangu_webhook_secret>
ONEKHUSA_SECRET_KEY=<your_onekhusa_api_key>  (for coach withdrawals)
ONEKHUSA_WEBHOOK_SECRET=<your_onekhusa_webhook_secret>  (for coach payouts)
```

### Required for All Functions
```
SUPABASE_URL=https://vbrxgaxjmpwusbbbzzgl.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
APP_BASE_URL=https://yourdomain.com  (or http://localhost:8080 for dev)
```

### Optional but Recommended
```
SUBSCRIPTION_ALERT_WEBHOOK=<your_slack_or_alert_webhook>
GRACE_PERIOD_DAYS=3
RENEWAL_MAX_ATTEMPTS=3
```

## How to Set Environment Variables in Supabase

### Step 1: Get Your Service Role Key
1. Go to https://app.supabase.com
2. Select your project: **expert-coaching-hub**
3. Click **Settings** in the sidebar
4. Click **API**
5. Copy the **Service Role** key (keep this secret!)

### Step 2: Get Your Paychangu Webhook Secret
1. Log into your Paychangu merchant dashboard
2. Go to **Settings** → **API Keys** or **Webhooks**
3. Find the webhook secret key
4. Copy it

### Step 3: Add Environment Variables to Supabase
1. In Supabase Dashboard, go to **Settings** → **Edge Functions** (if available)
   - OR go to **Settings** → **Environment Variables** → **Edge Functions**
2. Click **Add Environment Variable**
3. Add each variable:
   - **Name**: `PAYCHANGU_WEBHOOK_SECRET`
   - **Value**: `<paste_your_paychangu_secret>`
   - Repeat for other variables

### Alternative: Using Supabase CLI
```bash
# Set environment variables locally
supabase secrets set PAYCHANGU_WEBHOOK_SECRET="your_secret_here"
supabase secrets set ONEKHUSA_SECRET_KEY="your_key_here"
supabase secrets set ONEKHUSA_WEBHOOK_SECRET="your_webhook_secret_here"
```

## Database Schema Check

### Required Tables
Verify these tables exist:
- `transactions` - Payment transactions
- `credit_wallets` - User credit balances
- `credit_transactions` - Credit transaction audit log
- `webhook_processing_log` - Webhook processing history

### Query to Check Transaction Status
```sql
SELECT 
  id, 
  transaction_ref, 
  user_id, 
  status, 
  transaction_mode, 
  credits_amount,
  created_at 
FROM transactions 
WHERE status = 'pending' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Query to Check Wallet
```sql
SELECT 
  user_id, 
  balance, 
  updated_at 
FROM credit_wallets 
WHERE user_id = '<user_id>' 
LIMIT 1;
```

## Testing the Webhook

### Check if Webhook Endpoint is Reachable
```bash
curl -X GET https://vbrxgaxjmpwusbbbzzgl.supabase.co/functions/v1/paychangu-webhook
# Should return: {"status":"ok","message":"Webhook endpoint is active"}
```

### Test with Redirect Parameter
```bash
curl -X GET "https://vbrxgaxjmpwusbbbzzgl.supabase.co/functions/v1/paychangu-webhook?tx_ref=TEST-123"
# Should redirect to /client/credits/success or /coach/billing/success
```

## Paychangu Configuration

### Configure Webhook in Paychangu Dashboard
1. Log into Paychangu dashboard
2. Go to **Settings** → **Webhooks** or **API Configuration**
3. Set webhook URL to:
   ```
   https://vbrxgaxjmpwusbbbzzgl.supabase.co/functions/v1/paychangu-webhook
   ```
4. Make sure webhooks are **enabled**
5. Verify the webhook secret is saved

### Webhook Events to Enable
- ✅ Payment Success
- ✅ Payment Failed
- ✅ Payment Completed

## Verification Steps

1. **Check environment variables are set:**
   ```bash
   # In Supabase dashboard, Settings > Edge Functions
   # Verify PAYCHANGU_WEBHOOK_SECRET is listed
   ```

2. **Check webhook logs:**
   ```bash
   # In Supabase Dashboard:
   # Functions > paychangu-webhook > Logs
   # Should show recent webhook calls
   ```

3. **Verify database changes:**
   ```sql
   -- Check webhook_processing_log for recent entries
   SELECT * FROM webhook_processing_log 
   ORDER BY created_at DESC 
   LIMIT 5;
   
   -- Check transaction status
   SELECT id, status FROM transactions 
   WHERE created_at > NOW() - INTERVAL '24 hours'
   ORDER BY created_at DESC;
   ```

4. **Monitor in real-time:**
   - Use Supabase Studio: View raw transaction events
   - Use application logs to watch for payment completions

## Troubleshooting

### Webhook Returns 401 "Missing signature or secret"
- **Cause**: PAYCHANGU_WEBHOOK_SECRET is not set in Supabase
- **Fix**: Add the environment variable in Supabase Settings

### Webhook Returns "Invalid signature"
- **Cause**: Secret doesn't match Paychangu's secret or signature calculation is different
- **Fix**: Verify the secret in Supabase matches exactly what's in Paychangu

### Transaction stays in "pending" status
- **Cause**: Webhook never received or processing failed
- **Fix**: 
  1. Check Supabase function logs for errors
  2. Check Paychangu webhook logs to see if it sent the webhook
  3. Use recovery function to manually add credits

### Credits not added to wallet
- **Cause**: Webhook processing failed silently
- **Fix**: Use the `recover-failed-purchase` function to retry credit addition

## Related Functions

### Purchase Credits
```
supabase/functions/purchase-credits/
```
- Creates pending transaction
- Calls Paychangu API to get payment link
- Requires: ONEKHUSA_SECRET_KEY (for Paychangu API)

### Paychangu Webhook
```
supabase/functions/paychangu-webhook/
```
- Receives webhook from Paychangu
- Verifies signature with PAYCHANGU_WEBHOOK_SECRET
- Processes credit purchase
- Updates transaction status

### Recover Failed Purchase
```
supabase/functions/recover-failed-purchase/
```
- Admin-only function
- Manually add credits if webhook fails
- Requires: Admin authentication

## Next Steps

1. ✅ Add `PAYCHANGU_WEBHOOK_SECRET` to Supabase environment variables
2. ✅ Verify webhook URL is correct in Paychangu dashboard
3. ✅ Test with a small payment to verify flow works
4. ✅ Monitor logs during testing
5. ✅ Use recovery function for any failed transactions

## Support

If issues persist:
1. Check `/WEBHOOK_DIAGNOSTIC.md` for detailed debugging
2. Review Supabase function logs for error messages
3. Contact Paychangu support if webhook won't send
4. Use recovery function as temporary workaround
