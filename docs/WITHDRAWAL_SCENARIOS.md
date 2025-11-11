# Withdrawal Flow: Complete Scenario Coverage

## Overview
This document covers all success and failure scenarios for the coach withdrawal system, including error handling, recovery mechanisms, and monitoring.

---

## ✅ Success Scenarios

### 1. **Immediate Successful Withdrawal**
**Flow:**
1. Coach submits withdrawal request
2. Validation passes (amount, phone, balance, limits)
3. Security checks pass (rate limit, daily limit, credit aging, fraud score)
4. PayChangu payout executes successfully
5. `process_withdrawal` function deducts credits and updates DB
6. Coach receives mobile money instantly

**User Experience:**
- Success toast: "Withdrawal successful! MWK X sent to your mobile money. New balance: Y credits"
- Withdrawal appears as "completed" in history
- Credits immediately deducted from wallet

**Backend:**
- Status: `completed`
- Transaction recorded in `credit_transactions`
- Withdrawal request updated with payout references

---

### 2. **Pending Withdrawal (Async Processing)**
**Flow:**
1. Coach submits withdrawal request
2. Validation and security checks pass
3. PayChangu returns `pending` or `processing` status
4. Credits NOT deducted yet (waiting for confirmation)
5. Webhook will finalize when PayChangu confirms

**User Experience:**
- Info toast: "Withdrawal is being processed. You'll receive confirmation shortly."
- Withdrawal shows as "processing" in history
- Credits remain in wallet until confirmed

**Backend:**
- Status: `processing`
- Notes: "Payout pending with payment provider. Credits will be deducted upon confirmation."
- Webhook handler will complete the transaction

---

## ❌ Failure Scenarios

### 3. **Validation Errors**
**Triggers:**
- Amount < 10 credits or > 10,000 credits
- Invalid phone number format
- Insufficient balance
- Missing required fields

**User Experience:**
- Error toast with specific validation message
- Form shows inline validation errors
- No withdrawal request created

**Backend:**
- Request rejected before DB write
- No transaction created

---

### 4. **Security Check Failures**

#### 4a. Rate Limit Exceeded
**Trigger:** More than 5 withdrawal requests in 1 hour

**User Experience:**
- Error toast: "Rate limit exceeded. Maximum 5 withdrawal requests per hour. Please try again later."

**Backend:**
- Alert logged for monitoring
- No withdrawal request created

#### 4b. Daily Limit Exceeded
**Trigger:** Total withdrawals today + current request > 50,000 credits

**User Experience:**
- Error toast: "Daily withdrawal limit exceeded. You have withdrawn X credits today. Daily limit: 50,000 credits."

**Backend:**
- Request rejected
- No transaction created

#### 4c. Credit Aging Violation
**Trigger:** Credits are less than 3 days old

**User Experience:**
- Error toast: "Only X credits are available for withdrawal. Y credits are too recent (must age 3 days)."

**Backend:**
- Uses `get_available_withdrawable_credits` function
- Request rejected

#### 4d. High Fraud Score (≥75)
**Trigger:** Fraud detection flags suspicious activity

**User Experience:**
- Error toast: "This withdrawal has been flagged for manual review due to unusual activity. Please contact support for assistance."

**Backend:**
- Fraud alert sent to admin
- Withdrawal request created with `fraud_score` and `fraud_reasons`
- Status: `rejected`

---

### 5. **PayChangu Payout Failures**

#### 5a. API Error (Network/Server Issue)
**Trigger:** PayChangu API returns non-200 status

**User Experience:**
- Error toast: "Withdrawal failed: Payment provider unavailable. Your credits have been automatically refunded to your wallet."

**Backend:**
- Status: `failed`
- `rejection_reason`: Error message from PayChangu
- **Automatic refund via `refund_failed_withdrawal` function**
- Refund transaction created in `credit_transactions`

#### 5b. Payout Rejected by Provider
**Trigger:** PayChangu returns `failed` status (e.g., invalid account, insufficient funds)

**User Experience:**
- Error toast: "Withdrawal failed: Payout rejected: [reason]. Your credits have been automatically refunded to your wallet."

**Backend:**
- Status: `failed`
- `rejection_reason`: Failure reason from PayChangu
- **Automatic refund**
- Refund transaction created

---

### 6. **Critical Partial Failures** ⚠️

#### 6a. Payout Succeeds but DB Update Fails
**Trigger:** PayChangu payout succeeds but `process_withdrawal` function throws error

**User Experience:**
- Error toast: "Payout was successful but we couldn't update your balance. Support has been notified and will resolve this within 24 hours. Reference: [withdrawal_id]"

**Backend:**
- **CRITICAL ALERT sent to admin**
- Status: `processing` (stuck state)
- Requires manual intervention
- Admin dashboard shows critical alert

**Admin Action Required:**
1. Verify payout was sent to coach
2. Manually run `process_withdrawal` or update DB
3. Update status to `completed`

#### 6b. Refund Fails After Payout Failure
**Trigger:** Payout fails AND automatic refund fails

**User Experience:**
- Error toast: "Withdrawal failed and automatic refund failed. Support has been notified and will process your refund manually within 24 hours. Reference: [withdrawal_id]"

**Backend:**
- **CRITICAL ALERT sent to admin**
- Status: `failed`
- No refund transaction created
- Admin must manually refund credits

**Admin Action Required:**
1. Verify payout did NOT go through
2. Manually add credits back to coach's wallet
3. Create refund transaction record
4. Update withdrawal status

---

### 7. **Webhook-Based Failures**

#### 7a. Delayed Payout Failure
**Trigger:** Payout marked as `processing`, then PayChangu webhook reports failure

**User Experience:**
- Withdrawal shows as "processing" initially
- Later updates to "failed" with refund message

**Backend:**
- Webhook receives failure notification
- Status updated to `failed`
- **Automatic refund via webhook handler**
- Refund transaction created

---

## 🔍 Monitoring & Admin Tools

### Admin Dashboard Features
1. **Filter by Status:** All, Pending, Processing, Completed, Failed, Rejected
2. **Critical Alerts:** Highlights withdrawals needing manual intervention
3. **Fraud Score Display:** Shows high-risk withdrawals with reasons
4. **Failure Reason Display:** Color-coded by severity (red for critical, orange for standard)
5. **Manual Actions:** Approve/reject pending withdrawals (if manual review enabled)

### Alert Levels
- **Critical:** Payout succeeded but DB failed, or refund failed
- **Warning:** High fraud score, rate limit hit
- **Info:** Large transactions (>10,000 credits)

---

## 🔄 Recovery Mechanisms

### Automatic Recovery
1. **Refund on Payout Failure:** Immediate automatic refund via `refund_failed_withdrawal`
2. **Webhook Retry:** PayChangu webhooks can be replayed if processing fails
3. **Idempotency:** Withdrawal IDs prevent duplicate processing

### Manual Recovery (Admin)
1. **Verify payout status** with PayChangu dashboard
2. **Check database state** in Supabase
3. **Run SQL to fix stuck states:**
   ```sql
   -- Complete a stuck withdrawal
   SELECT process_withdrawal(
     coach_id := '[coach_uuid]',
     credits_amount := [amount],
     amount_mwk := [mwk_amount],
     withdrawal_id := '[withdrawal_uuid]',
     payout_ref := '[paychangu_ref]',
     payout_trans_id := '[paychangu_trans_id]'
   );
   
   -- Refund a failed withdrawal
   SELECT refund_failed_withdrawal(
     coach_id := '[coach_uuid]',
     credits_amount := [amount],
     withdrawal_id := '[withdrawal_uuid]'
   );
   ```

---

## 📊 Status Flow Diagram

```
[Coach Submits] 
    ↓
[Validation] → ❌ Rejected (validation error)
    ↓ ✅
[Security Checks] → ❌ Rejected (rate limit, fraud, etc.)
    ↓ ✅
[Create Withdrawal Request: processing]
    ↓
[PayChangu Payout]
    ↓
    ├─→ ⏳ Pending → [Webhook] → ✅ Completed / ❌ Failed + Refund
    ├─→ ✅ Success → [process_withdrawal] 
    │                    ↓
    │                    ├─→ ✅ Completed
    │                    └─→ ❌ CRITICAL: Manual intervention needed
    └─→ ❌ Failed → [Automatic Refund]
                        ↓
                        ├─→ ✅ Failed + Refunded
                        └─→ ❌ CRITICAL: Manual refund needed
```

---

## 🧪 Testing Checklist

### Success Cases
- [ ] Normal withdrawal (10-1000 credits)
- [ ] Large withdrawal (>1000 credits)
- [ ] Withdrawal with notes
- [ ] Multiple withdrawals in sequence

### Validation Failures
- [ ] Amount too small (<10)
- [ ] Amount too large (>10,000)
- [ ] Invalid phone format
- [ ] Insufficient balance
- [ ] Missing payment details

### Security Failures
- [ ] 6th request within 1 hour (rate limit)
- [ ] Exceeding daily limit (50,000 credits)
- [ ] Credits less than 3 days old
- [ ] New account with large withdrawal (fraud detection)

### Payout Failures
- [ ] Invalid phone number (PayChangu rejects)
- [ ] Network timeout
- [ ] PayChangu API down

### Edge Cases
- [ ] Concurrent withdrawal requests
- [ ] Wallet balance changes during processing
- [ ] Webhook arrives before function completes
- [ ] Duplicate webhook delivery

---

## 📝 User-Facing Messages

### Success
- ✅ "Withdrawal successful! MWK X sent to your mobile money. New balance: Y credits"
- ⏳ "Withdrawal is being processed. You'll receive confirmation shortly."

### Errors (with auto-refund)
- ❌ "Withdrawal failed: [reason]. Your credits have been automatically refunded to your wallet."

### Critical Errors (manual intervention)
- 🚨 "Payout was successful but we couldn't update your balance. Support has been notified and will resolve this within 24 hours. Reference: [id]"
- 🚨 "Withdrawal failed and automatic refund failed. Support has been notified and will process your refund manually within 24 hours. Reference: [id]"

---

## 🔐 Security Features

1. **Rate Limiting:** 5 requests per hour
2. **Daily Limits:** 50,000 credits per day
3. **Credit Aging:** 3-day cooldown period
4. **Fraud Detection:** Multi-factor scoring system
5. **Webhook Signature Verification:** HMAC-SHA256
6. **Atomic Transactions:** PostgreSQL functions with row locking
7. **Audit Trail:** All actions logged with timestamps and user IDs

---

## 📞 Support Procedures

### For Failed Withdrawals
1. Check withdrawal status in admin dashboard
2. Verify if refund was processed
3. If no refund, manually execute refund SQL
4. Contact coach with resolution

### For Critical Failures
1. Check PayChangu dashboard for payout status
2. Verify database state
3. Execute appropriate SQL fix
4. Document resolution in admin notes
5. Update coach via email/support ticket

---

## 🎯 Summary

**Total Scenarios Covered:** 15+
- ✅ Success: 2 scenarios
- ❌ Failures: 13+ scenarios
- 🔄 Recovery: Automatic + Manual

**Key Improvements:**
1. ✅ Pending state handling for async payouts
2. ✅ Automatic refunds on all payout failures
3. ✅ Critical alerts for manual intervention cases
4. ✅ Enhanced user feedback with specific error messages
5. ✅ Admin dashboard with filtering and fraud detection
6. ✅ Webhook-based failure recovery
7. ✅ Comprehensive monitoring and alerting

**All withdrawal scenarios now have proper error handling and recovery mechanisms!** 🎉
