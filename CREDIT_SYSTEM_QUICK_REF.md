# Credit System - Developer Quick Reference

**For:** Developers working with the credit system  
**Purpose:** Fast lookup guide for common tasks

---

## 🎯 Quick Facts

- **1 Credit = MWK 100**
- **Database:** PostgreSQL (Supabase)
- **Payment Gateway:** PayChangu
- **Edge Functions:** Deno/TypeScript
- **Frontend:** React + TypeScript

---

## 📁 File Locations

### Frontend
```
src/
  hooks/useCredits.ts              ← Main credit hook
  components/
    CreditWallet.tsx               ← Wallet display
    CreditTransactions.tsx         ← Transaction history
  pages/
    client/CreditPackages.tsx      ← Buy credits page
    coach/Withdrawals.tsx          ← Withdraw page
```

### Backend
```
supabase/
  functions/
    purchase-credits/index.ts      ← Initiate purchase
    paychangu-webhook/index.ts     ← Process payments
    enroll-with-credits/index.ts   ← Spend credits
    immediate-withdrawal/index.ts  ← Cash out
  migrations/
    remote_schema.sql              ← Database schema
    20241022000002_seed_credit_packages.sql
```

---

## 🗄️ Database Tables

### `credit_wallets`
```sql
{
  id: UUID
  user_id: UUID (unique)
  balance: NUMERIC(10,2)
  total_earned: NUMERIC(10,2)
  total_spent: NUMERIC(10,2)
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
}

-- Constraint: balance >= 0
```

### `credit_transactions`
```sql
{
  id: UUID
  user_id: UUID
  transaction_type: VARCHAR(50)
  amount: NUMERIC(10,2)
  balance_before: NUMERIC(10,2)
  balance_after: NUMERIC(10,2)
  reference_type: VARCHAR(50)
  reference_id: UUID
  description: TEXT
  metadata: JSONB
  created_at: TIMESTAMPTZ
}
```

### `credit_packages`
```sql
{
  id: UUID
  name: VARCHAR(100)
  description: TEXT
  credits: NUMERIC(10,2)
  price_mwk: INTEGER
  bonus_credits: NUMERIC(10,2)
  is_active: BOOLEAN
  sort_order: INTEGER
}
```

### `withdrawal_requests`
```sql
{
  id: UUID
  coach_id: UUID
  credits_amount: NUMERIC(10,2)
  amount: INTEGER  -- MWK
  status: VARCHAR(50)
  payment_method: VARCHAR(50)
  payment_details: JSONB
  processed_at: TIMESTAMPTZ
  created_at: TIMESTAMPTZ
}
```

---

## 🔧 Common Tasks

### Get User's Balance
```typescript
import { useCredits } from "@/hooks/useCredits";

const { balance, totalEarned, totalSpent } = useCredits();
```

### Purchase Credits
```typescript
const { purchaseCredits } = useCredits();

purchaseCredits.mutate(packageId);
// User is redirected to PayChangu checkout
```

### Enroll in Course with Credits
```typescript
const { enrollWithCredits } = useCredits();

enrollWithCredits.mutate(courseId);
// Credits transferred, enrollment created
```

### Request Withdrawal
```typescript
const { requestWithdrawal } = useCredits();

requestWithdrawal.mutate({
  credits_amount: 500,
  payment_method: "mobile_money",
  payment_details: { mobile: "+265999123456" },
  notes: "Optional note",
});
```

### Get Transaction History
```typescript
const { transactions, transactionsLoading } = useCredits();

transactions?.map(tx => ({
  type: tx.transaction_type,
  amount: tx.amount,
  date: tx.created_at,
}));
```

---

## 🔐 Database Functions

### `transfer_credits()`

**Purpose:** Atomically transfer credits between users

```sql
SELECT transfer_credits(
  from_user_id := '<client_id>',
  to_user_id := '<coach_id>',
  amount := 50.00,
  transaction_type := 'course_payment',
  reference_type := 'course_enrollment',
  reference_id := '<enrollment_id>',
  description := 'Enrolled in React Course',
  metadata := '{"course_id": "..."}'::jsonb
);
```

**Returns:**
```json
{
  "sender_transaction_id": "uuid",
  "receiver_transaction_id": "uuid"
}
```

**Errors:**
- `'Insufficient balance'`
- `'Sender wallet not found'`
- `'Amount must be positive'`

---

## 🌐 API Endpoints

### Edge Functions

**Purchase Credits**
```bash
POST /functions/v1/purchase-credits
Authorization: Bearer <user_token>

{
  "package_id": "uuid"
}

Response:
{
  "checkout_url": "https://checkout.paychangu.com/...",
  "transaction_ref": "uuid",
  "credits_amount": 530,
  "package_name": "Popular"
}
```

**Enroll with Credits**
```bash
POST /functions/v1/enroll-with-credits
Authorization: Bearer <user_token>

{
  "course_id": "uuid"
}

Response:
{
  "success": true,
  "enrollment_id": "uuid",
  "credits_paid": 50,
  "transaction_id": "uuid"
}
```

**Request Withdrawal**
```bash
POST /functions/v1/immediate-withdrawal
Authorization: Bearer <user_token>

{
  "credits_amount": 500,
  "payment_method": "mobile_money",
  "payment_details": {
    "mobile": "+265999123456"
  },
  "notes": "Optional"
}

Response:
{
  "success": true,
  "withdrawal_request_id": "uuid",
  "credits_amount": 500,
  "amount_mwk": 50000,
  "new_balance": 200
}
```

---

## 📝 Transaction Types

| Type | Direction | Description |
|------|-----------|-------------|
| `purchase` | + | Bought credits via PayChangu |
| `course_payment` | - | Spent credits on course |
| `course_earning` | + | Earned from student enrollment |
| `withdrawal` | - | Withdrew to mobile money |
| `refund` | + | Failed withdrawal refund |

---

## 🧪 Testing Locally

### 1. Setup Environment Variables
```bash
# .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Test Credit Purchase (without real payment)
```typescript
// Manually insert credits for testing
const { error } = await supabase
  .from("credit_transactions")
  .insert({
    user_id: userId,
    transaction_type: "purchase",
    amount: 500,
    balance_before: 0,
    balance_after: 500,
    description: "Test purchase",
  });

await supabase
  .from("credit_wallets")
  .update({ balance: 500 })
  .eq("user_id", userId);
```

### 3. Test Enrollment
```typescript
// Ensure course has price_credits set
await supabase
  .from("courses")
  .update({ price_credits: 50 })
  .eq("id", courseId);

// Then test enrollment flow
const { enrollWithCredits } = useCredits();
await enrollWithCredits.mutateAsync(courseId);
```

---

## 🐛 Common Issues

### "Insufficient balance"
**Cause:** User doesn't have enough credits  
**Fix:** Check wallet balance before attempting transfer

### "Wallet not found"
**Cause:** User doesn't have a wallet yet  
**Fix:** Wallets are auto-created on signup. If missing:
```sql
INSERT INTO credit_wallets (user_id, balance)
VALUES ('<user_id>', 0);
```

### "Package not found"
**Cause:** Package is inactive or deleted  
**Fix:** Check `is_active = true` on credit_packages

### "Invalid mobile number"
**Cause:** Wrong format for Malawi numbers  
**Fix:** Must be 9 digits starting with 99, 88, 77, or 76

---

## 🔍 Debugging

### Check Wallet Balance
```sql
SELECT * FROM credit_wallets
WHERE user_id = '<user_id>';
```

### View Transaction History
```sql
SELECT * FROM credit_transactions
WHERE user_id = '<user_id>'
ORDER BY created_at DESC
LIMIT 10;
```

### Check Pending Transactions
```sql
SELECT * FROM transactions
WHERE user_id = '<user_id>'
  AND status = 'pending'
ORDER BY created_at DESC;
```

### View Withdrawal Requests
```sql
SELECT * FROM withdrawal_requests
WHERE coach_id = '<coach_id>'
ORDER BY created_at DESC;
```

---

## ⚙️ Configuration

### Credit Package Prices
```sql
-- View current packages
SELECT name, credits, bonus_credits, price_mwk, is_active
FROM credit_packages
ORDER BY sort_order;

-- Add new package
INSERT INTO credit_packages (
  name, description, credits, bonus_credits, 
  price_mwk, is_active, sort_order
) VALUES (
  'Enterprise',
  'For organizations',
  10000,
  1000,
  900000,
  true,
  6
);

-- Deactivate package
UPDATE credit_packages
SET is_active = false
WHERE name = 'Starter';
```

### Conversion Rate
```typescript
// Defined in: src/pages/coach/Withdrawals.tsx
const CONVERSION_RATE = 100; // 1 credit = 100 MWK

// To change, update this constant
```

### Withdrawal Limits
```typescript
// Defined in: supabase/functions/immediate-withdrawal/index.ts
const MAX_WITHDRAWAL = 100000;
const MIN_WITHDRAWAL = 10;

// To change, update these constants
```

---

## 🎨 UI Components

### Display Credit Balance
```tsx
import { CreditWallet } from "@/components/CreditWallet";

<CreditWallet 
  showActions={true}  // Show Buy/Withdraw buttons
  compact={false}     // Full view with stats
/>
```

### Display Transactions
```tsx
import { CreditTransactions } from "@/components/CreditTransactions";

<CreditTransactions />
```

### Manual Credit Display
```tsx
const { balance } = useCredits();

<div>
  <span>{balance.toFixed(2)} Credits</span>
</div>
```

---

## 🚨 Error Handling

### Frontend
```typescript
const { purchaseCredits } = useCredits();

purchaseCredits.mutate(packageId, {
  onError: (error) => {
    console.error("Purchase failed:", error);
    toast.error(error.message);
  },
  onSuccess: (data) => {
    console.log("Redirecting to:", data.checkout_url);
  },
});
```

### Edge Function
```typescript
try {
  // ... operation
} catch (error) {
  console.error("Error:", error);
  return new Response(
    JSON.stringify({ error: error.message }),
    { 
      status: 400,
      headers: { "Content-Type": "application/json" }
    }
  );
}
```

---

## 📊 Analytics Queries

### Total Credits Purchased
```sql
SELECT 
  SUM(amount) as total_purchased,
  COUNT(*) as purchase_count
FROM credit_transactions
WHERE transaction_type = 'purchase';
```

### Total Credits Spent
```sql
SELECT 
  SUM(ABS(amount)) as total_spent,
  COUNT(*) as enrollment_count
FROM credit_transactions
WHERE transaction_type = 'course_payment';
```

### Total Withdrawals
```sql
SELECT 
  SUM(ABS(amount)) as total_withdrawn,
  COUNT(*) as withdrawal_count
FROM credit_transactions
WHERE transaction_type = 'withdrawal';
```

### Popular Packages
```sql
SELECT 
  cp.name,
  COUNT(t.id) as purchase_count,
  SUM(t.amount) as total_revenue
FROM transactions t
JOIN credit_packages cp ON t.credit_package_id = cp.id
WHERE t.status = 'success'
  AND t.transaction_mode = 'credit_purchase'
GROUP BY cp.name
ORDER BY purchase_count DESC;
```

---

## 🔐 Security Checklist

- [ ] User authenticated before operations
- [ ] Balance validated before transfers
- [ ] Row locking prevents race conditions
- [ ] Webhook signatures verified
- [ ] Input validation on all fields
- [ ] RLS policies active on tables
- [ ] Audit trail complete

---

## 📚 Related Documentation

- **Deep Dive:** `CREDIT_SYSTEM_DEEP_DIVE.md`
- **Summary:** `CREDIT_SYSTEM_SUMMARY.md`
- **Bug Fixes:** `BUG_REPORT.md`
- **Audit:** `AUDIT_COMPLETE.md`

---

## 🆘 Quick Help

**Issue:** Credits not showing after payment  
**Check:** 
1. Transaction status in `transactions` table
2. Webhook logs in Edge Function
3. Wallet balance in `credit_wallets`

**Issue:** Can't withdraw credits  
**Check:**
1. User has coach/admin role
2. Balance is sufficient
3. Phone number format correct
4. PayChangu API credentials set

**Issue:** Enrollment fails  
**Check:**
1. Course is published
2. User has enough credits
3. Not already enrolled
4. Coach wallet exists

---

**Last Updated:** 2025-10-23  
**Maintainer:** Development Team  
**Questions?** Check full documentation or ask the team
