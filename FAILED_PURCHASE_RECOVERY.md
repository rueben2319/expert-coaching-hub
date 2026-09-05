# Credit Purchase Failed Transaction Recovery Guide

## Issue Summary
**Problem**: Client completes payment via **Paychangu**, money is received by admin, but transaction is not recorded in database and credits are not added to client's wallet.

**Root Cause**: The webhook callback (Step 5 in the payment flow) either failed or never arrived from Paychangu.

---

## Payment Flow (6 Steps)

```
1. Transaction created (status: pending)
2. Paychangu payment link generated
3. Client completes payment with Paychangu
4. Paychangu confirms payment to admin account ✅ (COMPLETED)
5. Paychangu sends webhook callback → Webhook processes it ❌ (FAILED HERE)
6. Credits added to client's wallet
```

**Note**: Paychangu handles all client credit purchases. OneKhusa is used only for coach withdrawal payouts to mobile money.

---

## Troubleshooting Checklist

### ✅ Quick Verification (Admin)

1. **Confirm payment was received**
   - Check Paychangu admin dashboard
   - Verify amount and transaction reference
   - Confirm funds in main account

2. **Find the failed transaction**
   - Go to Supabase Studio
   - Open `transactions` table
   - Filter by: `transaction_mode = 'credit_purchase'` AND `status = 'pending'`
   - Look for transactions from today with matching amount paid via Paychangu
   - Note the `transaction_ref` (UUID) and `transaction_id`

3. **Check webhook processing log**
   - Open `webhook_processing_log` table
   - Search for the transaction's `transaction_ref`
   - Look at `status` and `error_message` fields
   - Possible statuses:
     - `null` → Webhook never received from Paychangu
     - `processing` → Webhook is stuck
     - `failed` → Webhook failed with error message

4. **Client verification**
   - Check if credits were added (check `credit_wallets` table)
   - Check `credit_transactions` table for purchase records
   - Verify wallet balance didn't increase

---

## Recovery Options

### Option 1: Use Admin API (Recommended)

**Best for**: Single failed transactions, quick recovery

```bash
curl -X POST https://your-app.com/functions/v1/recover-failed-purchase \
  -H "Authorization: Bearer {ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d {
    "transaction_id": "{UUID_FROM_TRANSACTIONS_TABLE}",
    "confirm_payment_received": true
  }
```

**Response**:
```json
{
  "success": true,
  "message": "Transaction recovered successfully",
  "details": {
    "transaction_id": "...",
    "user_id": "...",
    "credits_added": 1000,
    "new_balance": 2500
  }
}
```

### Option 2: Manual Database Recovery

**Best for**: Bulk recovery, audit trail preservation

Run the SQL script in `scripts/recover-failed-purchase.sql`:

```sql
-- Step 1: Find pending/failed transactions
SELECT t.id, t.user_id, t.credits_amount, t.amount, 
       t.status, u.email
FROM transactions t
JOIN auth.users u ON t.user_id = u.id
WHERE t.transaction_mode = 'credit_purchase'
  AND t.status IN ('pending', 'failed')
  AND t.created_at > now() - interval '7 days'
ORDER BY t.created_at DESC;

-- Step 2: Uncomment and edit the recovery section
-- Replace {transaction_id} with actual transaction ID
-- Execute the commented recovery block
```

### Option 3: Check Webhook Logs

**Best for**: Understanding what went wrong

```sql
-- Find webhook processing errors
SELECT id, tx_ref, status, error_message, processed_at, payload
FROM webhook_processing_log
WHERE tx_ref = '{TRANSACTION_REF}'
ORDER BY created_at DESC LIMIT 1;
```

Common webhook errors:
- `"Missing signature"` → Webhook signature verification failed
- `"Transaction not found"` → Transaction ID mismatch (tx_ref doesn't exist)
- `"Failed to update wallet"` → Database constraint error
- `"Failed to create wallet"` → Wallet creation error
- `"Missing status in webhook payload"` → Malformed webhook data

---

## Data to Collect for Support

If recovery fails, collect:

1. **From Paychangu Admin Dashboard**:
   - Paychangu transaction reference
   - Amount paid
   - Client phone number or email
   - Payment timestamp
   - Payment status (should show as completed)

2. **From Supabase**:
   - Transaction ID from `transactions` table
   - Transaction reference (UUID)
   - Webhook log entry from `webhook_processing_log`
   - Error message from webhook processing log
   - Current wallet balance from `credit_wallets`

3. **Application Info**:
   - Client email address
   - Expected credit amount
   - Credit package name
   - Exact time of payment attempt

---

## Preventing Future Issues

### 1. Webhook Signature Verification
- ✅ Currently implemented
- Verify webhook signature verification is set correctly in environment
- Paychangu sends signature in webhook header for verification

### 2. Webhook Idempotency
- ✅ Currently implemented via `webhook_processing_log` table
- Duplicate webhooks are silently ignored (status check)
- Prevents double-crediting

### 3. Transaction Atomicity
- ✅ Currently implemented with Postgres RPC
- All wallet updates happen together
- No partial credits possible

### 4. Monitoring & Alerts
- ⚠️ Needs enhancement
- Add webhook failure monitoring
- Alert admin when webhook fails
- Automatic retry mechanism for pending transactions

---

## Next Steps

### Immediate (Today)
1. Use Option 1 (Admin API) to recover the failed transaction
2. Verify credits appear in client's wallet
3. Document the issue in support ticket

### Short-term (This Week)
1. Review webhook logs for other failures
2. Check all `transactions` with `status = 'pending'` created > 24 hours ago
3. Recover any other failed transactions

### Long-term (Next Sprint)
1. Implement webhook retry logic
2. Add admin dashboard for manual recovery
3. Implement real-time webhook failure alerts
4. Add automatic recovery for pending transactions after timeout
5. Improve webhook error messages and logging

---

## Testing Recovery

To test the recovery mechanism:

```bash
# 1. Create a test transaction (set status to 'pending')
INSERT INTO transactions (
  user_id, transaction_ref, amount, currency, 
  status, transaction_mode, credit_package_id, 
  credits_amount
) VALUES (
  '123e4567-e89b-12d3-a456-426614174000',
  '987e6543-e89b-12d3-a456-426614174999',
  50000, 'MWK',
  'pending', 'credit_purchase', 'package-id',
  1000
) RETURNING id;

# 2. Call recovery API with the returned ID
# 3. Verify transaction status changed to 'success'
# 4. Verify credits added to wallet
# 5. Verify credit_transactions record created
```

---

## Support Contact

If recovery fails after following this guide, contact support with:
- Transaction ID
- Webhook error message
- Exact timestamp of payment
- Screenshots of OneKhusa confirmation
