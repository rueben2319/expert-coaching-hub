# ✅ **CREDIT TABLES UPDATE PROCESSES - COMPLETE ANALYSIS**

## **📊 Processes That Update `credit_transactions` & `credit_wallets`**

---

## **🔄 1. Credit Purchase Success Flow**

### **Process:** `credits-webhook` Edge Function
### **Trigger:** PayChangu webhook when payment succeeds
### **Tables Updated:** `credit_wallets`, `credit_transactions`

**Code Location:** `supabase/functions/credits-webhook/index.ts`

```typescript
// Updates wallet balance
await supabase
  .from("credit_wallets")
  .update({
    balance: balanceAfter,        // ✅ WALLET UPDATED
    updated_at: new Date().toISOString(),
  })
  .eq("user_id", tx.user_id);

// Creates transaction record
await supabase
  .from("credit_transactions")
  .insert({
    user_id: tx.user_id,
    transaction_type: "purchase",     // ✅ TRANSACTION CREATED
    amount: creditsToAdd,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    // ... metadata
  });
```

---

## **🔄 2. Course Enrollment with Credits**

### **Process:** `enroll-with-credits` Edge Function
### **Trigger:** User enrolls in paid course
### **Tables Updated:** `credit_wallets`, `credit_transactions`

**Code Location:** `supabase/functions/enroll-with-credits/index.ts`

```typescript
// Calls transfer_credits RPC function
const { data: transferResult } = await supabase.rpc(
  "transfer_credits",           // ✅ RPC CALL
  {
    from_user_id: user.id,
    to_user_id: course.coach_id,
    amount: creditsRequired,
    transaction_type: "course_payment",
    // ...
  }
);
```

---

## **🔄 3. Withdrawal Request Process**

### **Process:** `request-withdrawal` Edge Function
### **Trigger:** Coach requests credit withdrawal
### **Tables Updated:** `credit_wallets`, `credit_transactions`

**Code Location:** `supabase/functions/request-withdrawal/index.ts`

```typescript
// Updates wallet balance (holds credits)
await supabase
  .from("credit_wallets")
  .update({
    balance: balanceAfter,        // ✅ WALLET UPDATED
    updated_at: new Date().toISOString(),
  })
  .eq("user_id", user.id);

// Creates transaction record
await supabase
  .from("credit_transactions")
  .insert({
    user_id: user.id,
    transaction_type: "withdrawal",    // ✅ TRANSACTION CREATED
    amount: -creditsToWithdraw,
    balance_before: currentBalance,
    balance_after: balanceAfter,
    // ...
  });
```

---

## **🔄 4. New User Signup Trigger**

### **Process:** Database Trigger on `auth.users`
### **Trigger:** User signs up
### **Tables Updated:** `credit_wallets`

**Code Location:** Migration trigger in `handle_new_user()` function

```sql
-- Trigger automatically creates wallet for new users
CREATE TRIGGER on_user_created_init_wallet
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION initialize_credit_wallet();

-- Function creates wallet
INSERT INTO public.credit_wallets (user_id, balance)
VALUES (NEW.id, 0.00)
ON CONFLICT (user_id) DO NOTHING;
```

---

## **🔄 5. RPC Function: `transfer_credits`**

### **Process:** Direct RPC call or internal function call
### **Trigger:** Various operations (enrollment, etc.)
### **Tables Updated:** `credit_wallets`, `credit_transactions`

**Code Location:** Database function in migration

```sql
CREATE OR REPLACE FUNCTION transfer_credits(...)
RETURNS JSONB AS $$
-- Updates both wallets atomically
UPDATE credit_wallets SET balance = balance - amount WHERE user_id = from_user_id;
UPDATE credit_wallets SET balance = balance + amount WHERE user_id = to_user_id;

-- Creates two transaction records
INSERT INTO credit_transactions (...) VALUES (...); -- Sender
INSERT INTO credit_transactions (...) VALUES (...); -- Receiver
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## **📋 Summary of Update Processes**

| Process | Trigger | Tables Updated | Method |
|---------|---------|----------------|---------|
| **Purchase Success** | PayChangu webhook | `credit_wallets`, `credit_transactions` | Edge Function |
| **Course Enrollment** | User enrolls in paid course | `credit_wallets`, `credit_transactions` | Edge Function + RPC |
| **Withdrawal Request** | Coach requests payout | `credit_wallets`, `credit_transactions` | Edge Function |
| **User Signup** | New user registration | `credit_wallets` | Database Trigger |
| **Credit Transfer** | Various operations | `credit_wallets`, `credit_transactions` | RPC Function |

---

## **🎯 Answer: YES - Multiple Processes Update These Tables**

**The credit system has 5 distinct processes that update `credit_transactions` and `credit_wallets`:**

1. **Webhook processing** (successful purchases)
2. **Course enrollment** (paid courses)  
3. **Withdrawal requests** (coach payouts)
4. **User registration** (automatic wallet creation)
5. **RPC transfers** (atomic credit movements)

**All processes are active and operational!** 🚀
