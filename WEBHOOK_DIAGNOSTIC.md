# Webhook Diagnostic Guide

## Issue: Credits Not Added After Successful Payment

When a user completes payment through Paychangu and is redirected to the success page, but credits are not added to their wallet, it's usually due to webhook processing failure.

## Common Causes

### 1. Missing Environment Variable: PAYCHANGU_WEBHOOK_SECRET
**Symptoms:**
- Webhook returns 401 "Missing signature or secret"
- Transaction status remains "pending" instead of "success"

**Fix:**
```bash
# In Supabase Dashboard:
# 1. Go to Project Settings → Edge Functions → Environment Variables
# 2. Add: PAYCHANGU_WEBHOOK_SECRET=<your_paychangu_webhook_secret>
```

To find your Paychangu webhook secret:
1. Log in to Paychangu Dashboard
2. Go to Settings → API Keys or Webhooks
3. Copy the webhook secret key
4. Add it to Supabase environment variables

### 2. Webhook Signature Mismatch
**Symptoms:**
- Webhook received but signature verification fails
- Error: "❌ SIGNATURE VERIFICATION FAILED"

**Check:**
- Verify the secret in Supabase matches Paychangu exactly
- Check the raw body being sent by Paychangu hasn't been modified

### 3. Webhook Callback Not Being Sent
**Symptoms:**
- No webhook received at all
- Transaction status remains "pending"

**Check in Paychangu:**
1. Log into Paychangu Dashboard
2. Go to Webhooks or API settings
3. Verify webhook URL is: `https://<your_project_id>.supabase.co/functions/v1/paychangu-webhook`
4. Verify webhook is enabled and configured to send payment notifications
5. Check webhook logs in Paychangu to see if it's attempting to send

## Manual Recovery

If a payment has been completed but credits weren't added, use one of these options:

### Option A: Use the Recovery API (Recommended)
```bash
# Call the recovery function via HTTP (requires admin auth)
curl -X POST https://<your_project_id>.supabase.co/functions/v1/recover-failed-purchase \
  -H "Authorization: Bearer <your_service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "<transaction_uuid>",
    "confirm_payment_received": true
  }'
```

### Option B: Manual SQL Recovery
In Supabase SQL Editor:
```sql
-- 1. Find the failed transaction
SELECT id, user_id, amount, credits_amount, status, created_at 
FROM transactions 
WHERE transaction_ref = 'YOUR_TX_REF' 
AND status = 'pending';

-- 2. Update transaction to success and add credits
WITH tx AS (
  SELECT id, user_id, credits_amount
  FROM transactions
  WHERE id = '<transaction_id>'
  AND status = 'pending'
)
UPDATE credit_wallets
SET balance = balance + (SELECT credits_amount FROM tx)
WHERE user_id = (SELECT user_id FROM tx);

-- 3. Update transaction status
UPDATE transactions 
SET status = 'success'
WHERE id = '<transaction_id>';

-- 4. Create audit record
INSERT INTO credit_transactions (user_id, transaction_type, amount, reference_id, description)
SELECT user_id, 'purchase', credits_amount, id, 'Credit purchase (recovered)'
FROM transactions WHERE id = '<transaction_id>';
```

## Debug Logging

The webhook logs the following information that can help diagnose issues:

1. **Webhook Received** - Indicates the request arrived at the function
2. **Signature present** - Whether X-Paychangu-Webhook-Signature header was found
3. **Signature verification result** - Whether signature check passed
4. **Transaction lookup** - Whether transaction was found in database
5. **Payment success status** - How the payment status was interpreted
6. **Credit processing** - Details of wallet update and credit addition

Check these logs in:
- Supabase Dashboard → Functions → paychangu-webhook → Logs

## Testing the Webhook Locally

For development testing:

```bash
# Test with curl
curl -X POST http://localhost:54321/functions/v1/paychangu-webhook \
  -H "Content-Type: application/json" \
  -H "X-Paychangu-Webhook-Signature: <your_test_signature>" \
  -d '{
    "status": "success",
    "tx_ref": "TEST-123456",
    "amount": 5000,
    "currency": "MWK"
  }'
```

## Webhook Payload Expected Format

Paychangu should send webhooks in this format:

```json
{
  "status": "success",
  "tx_ref": "TXN_ABC123",
  "amount": 5000,
  "currency": "MWK",
  "data": {
    "status": "success",
    "tx_ref": "TXN_ABC123"
  }
}
```

## Next Steps

1. **Check Environment Variables:**
   - Verify PAYCHANGU_WEBHOOK_SECRET is set in Supabase
   
2. **Check Paychangu Settings:**
   - Verify webhook URL is correct
   - Verify webhook is enabled
   
3. **Check Logs:**
   - Review Supabase Edge Function logs for errors
   
4. **Manual Recovery:**
   - If webhook won't work, use the recovery API or SQL method
   
5. **Contact Paychangu Support:**
   - If webhook still won't send, contact Paychangu support with webhook logs

## Quick Checklist

- [ ] PAYCHANGU_WEBHOOK_SECRET is set in Supabase environment
- [ ] Webhook URL in Paychangu matches your Supabase project
- [ ] Webhook is enabled in Paychangu settings
- [ ] Supabase Edge Function logs show "Signature verification passed"
- [ ] Transaction status changed from "pending" to "success"
- [ ] Credits were added to user wallet
