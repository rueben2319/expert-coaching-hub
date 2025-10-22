# 💳 Credit System Implementation Guide

## **Overview**

The credit system has been fully implemented with the following components:

### **✅ Completed**

1. **Edge Functions** (4 functions)
2. **React Hooks** (useCredits)
3. **Database Schema** (already migrated)

### **📋 To Implement** (UI Components)

---

## **1. Edge Functions Created**

### **`purchase-credits`**
- **Purpose**: Initiate credit purchase via PayChangu
- **Endpoint**: `/functions/v1/purchase-credits`
- **Method**: POST
- **Body**: `{ package_id: string }`
- **Returns**: `{ checkout_url, transaction_ref, credits_amount, package_name }`

### **`credits-webhook`**
- **Purpose**: Handle PayChangu payment confirmation
- **Endpoint**: `/functions/v1/credits-webhook`
- **Method**: POST (webhook) / GET (redirect)
- **Process**:
  1. Verifies webhook signature
  2. Updates transaction status
  3. Adds credits to user wallet
  4. Creates credit transaction record

### **`enroll-with-credits`**
- **Purpose**: Enroll in course using credits
- **Endpoint**: `/functions/v1/enroll-with-credits`
- **Method**: POST
- **Body**: `{ course_id: string }`
- **Process**:
  1. Checks if course is free or paid
  2. Transfers credits from client to coach
  3. Creates enrollment record
  4. Returns enrollment details

### **`request-withdrawal`**
- **Purpose**: Coach requests to withdraw earnings
- **Endpoint**: `/functions/v1/request-withdrawal`
- **Method**: POST
- **Body**:
```typescript
{
  credits_amount: number,
  payment_method: "bank_transfer" | "mobile_money",
  payment_details: {
    account_number?: string,
    bank_name?: string,
    account_name?: string,
    phone_number?: string
  },
  notes?: string
}
```
- **Process**:
  1. Verifies coach has sufficient balance
  2. Deducts credits from wallet
  3. Creates withdrawal request (pending)
  4. Creates transaction record

---

## **2. React Hook: `useCredits`**

### **Location**: `src/hooks/useCredits.ts`

### **Usage**:
```typescript
import { useCredits } from "@/hooks/useCredits";

function MyComponent() {
  const {
    // Wallet data
    wallet,
    balance,
    totalEarned,
    totalSpent,
    
    // Packages
    packages,
    
    // Transactions
    transactions,
    
    // Withdrawal requests
    withdrawalRequests,
    
    // Mutations
    purchaseCredits,
    enrollWithCredits,
    requestWithdrawal,
  } = useCredits();

  // Purchase credits
  const handlePurchase = (packageId: string) => {
    purchaseCredits.mutate(packageId);
  };

  // Enroll in course
  const handleEnroll = (courseId: string) => {
    enrollWithCredits.mutate(courseId);
  };

  // Request withdrawal
  const handleWithdraw = () => {
    requestWithdrawal.mutate({
      credits_amount: 1000,
      payment_method: "bank_transfer",
      payment_details: {
        account_number: "1234567890",
        bank_name: "Standard Bank",
        account_name: "John Doe"
      }
    });
  };
}
```

---

## **3. UI Components to Create**

### **A. Credit Wallet Component**
**File**: `src/components/CreditWallet.tsx`

**Features**:
- Display current balance
- Show total earned (coaches)
- Show total spent (clients)
- Quick action buttons (Buy Credits, Withdraw)

**Example**:
```tsx
import { useCredits } from "@/hooks/useCredits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Plus, ArrowDownToLine } from "lucide-react";

export function CreditWallet() {
  const { balance, totalEarned, totalSpent, walletLoading } = useCredits();

  if (walletLoading) return <div>Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Credit Wallet
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Available Balance</p>
            <p className="text-3xl font-bold">{balance} Credits</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Earned</p>
              <p className="text-lg font-semibold">{totalEarned}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Spent</p>
              <p className="text-lg font-semibold">{totalSpent}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button className="flex-1">
              <Plus className="h-4 w-4 mr-2" />
              Buy Credits
            </Button>
            <Button variant="outline" className="flex-1">
              <ArrowDownToLine className="h-4 w-4 mr-2" />
              Withdraw
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### **B. Credit Packages Page**
**File**: `src/pages/client/CreditPackages.tsx`

**Features**:
- Display all available credit packages
- Show bonus credits
- Calculate value (credits per MWK)
- Purchase button redirects to PayChangu

**Example Structure**:
```tsx
import { useCredits } from "@/hooks/useCredits";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function CreditPackages() {
  const { packages, purchaseCredits } = useCredits();

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {packages?.map((pkg) => (
        <Card key={pkg.id}>
          <CardHeader>
            <CardTitle>{pkg.name}</CardTitle>
            {pkg.bonus_credits > 0 && (
              <Badge variant="secondary">
                +{pkg.bonus_credits} Bonus Credits
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-4xl font-bold">
                {pkg.credits + pkg.bonus_credits}
              </p>
              <p className="text-sm text-muted-foreground">Credits</p>
              <p className="text-2xl font-semibold mt-4">
                MWK {pkg.price_mwk.toLocaleString()}
              </p>
              <Button 
                className="w-full mt-4"
                onClick={() => purchaseCredits.mutate(pkg.id)}
              >
                Purchase
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

---

### **C. Update Course Enrollment**
**File**: `src/pages/client/Courses.tsx`

**Changes Needed**:
1. Check if course is free or paid
2. Show credit price if paid
3. Use `enrollWithCredits` mutation instead of direct insert

**Example**:
```tsx
const handleEnrollClick = (course: any) => {
  if (isEnrolled(course)) {
    navigate(`/client/course/${course.id}`);
    return;
  }

  // Check if course is free
  if (course.is_free || !course.price_credits || course.price_credits === 0) {
    // Free enrollment (existing logic)
    enrollMutation.mutate(course.id);
  } else {
    // Paid enrollment with credits
    enrollWithCredits.mutate(course.id);
  }
};

// In the course card, show price
{!isEnrolled(course) && course.price_credits > 0 && (
  <Badge variant="secondary">
    {course.price_credits} Credits
  </Badge>
)}
```

---

### **D. Withdrawal Request Page (Coaches)**
**File**: `src/pages/coach/Withdrawals.tsx`

**Features**:
- Display current balance
- Withdrawal request form
- List of past withdrawal requests with status
- Conversion rate display (credits → MWK)

**Example Structure**:
```tsx
import { useCredits } from "@/hooks/useCredits";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export default function Withdrawals() {
  const { balance, requestWithdrawal, withdrawalRequests } = useCredits();
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentDetails, setPaymentDetails] = useState({});

  const conversionRate = 100; // 1 credit = 100 MWK
  const mwkAmount = Number(amount) * conversionRate;

  const handleSubmit = () => {
    requestWithdrawal.mutate({
      credits_amount: Number(amount),
      payment_method: paymentMethod,
      payment_details: paymentDetails,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Request Withdrawal</CardTitle>
          <CardDescription>
            Available Balance: {balance} Credits (≈ MWK {(balance * conversionRate).toLocaleString()})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Amount (Credits)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                max={balance}
              />
              <p className="text-sm text-muted-foreground mt-1">
                ≈ MWK {mwkAmount.toLocaleString()}
              </p>
            </div>

            <div>
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="mobile_money">Mobile Money</option>
              </Select>
            </div>

            {/* Payment details fields based on method */}
            
            <Button onClick={handleSubmit} disabled={!amount || Number(amount) > balance}>
              Submit Withdrawal Request
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List of withdrawal requests */}
      <Card>
        <CardHeader>
          <CardTitle>Withdrawal History</CardTitle>
        </CardHeader>
        <CardContent>
          {withdrawalRequests?.map((request) => (
            <div key={request.id} className="border-b py-3">
              <div className="flex justify-between">
                <div>
                  <p className="font-medium">{request.credits_amount} Credits</p>
                  <p className="text-sm text-muted-foreground">
                    MWK {request.amount.toLocaleString()}
                  </p>
                </div>
                <Badge variant={
                  request.status === "completed" ? "default" :
                  request.status === "pending" ? "secondary" :
                  request.status === "rejected" ? "destructive" : "outline"
                }>
                  {request.status}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### **E. Credit Transaction History**
**File**: `src/components/CreditTransactions.tsx`

**Features**:
- List all credit transactions
- Filter by type (purchase, course_payment, course_earning, withdrawal)
- Show balance before/after
- Display metadata (course name, etc.)

---

### **F. Success Pages**

**Credit Purchase Success**:
**File**: `src/pages/client/CreditPurchaseSuccess.tsx`

```tsx
import { useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function CreditPurchaseSuccess() {
  const [searchParams] = useSearchParams();
  const txRef = searchParams.get("tx_ref");
  const queryClient = useQueryClient();

  useEffect(() => {
    // Invalidate queries to refresh wallet balance
    queryClient.invalidateQueries({ queryKey: ["credit_wallet"] });
    queryClient.invalidateQueries({ queryKey: ["credit_transactions"] });
  }, [queryClient]);

  return (
    <div className="text-center py-12">
      <h1 className="text-3xl font-bold mb-4">Purchase Successful!</h1>
      <p>Your credits have been added to your wallet.</p>
      <p className="text-sm text-muted-foreground">Transaction: {txRef}</p>
    </div>
  );
}
```

---

## **4. Navigation Updates**

### **Add to Client Navigation**:
```tsx
// src/config/navigation.tsx
export const clientNavItems = [
  { label: "Dashboard", href: "/client" },
  { label: "Explore", href: "/client/courses" },
  { label: "My Courses", href: "/client/my-courses" },
  { label: "Credits", href: "/client/credits" }, // NEW
  { label: "Analytics", href: "/client/analytics" },
  { label: "Sessions", href: "/client/sessions" },
];
```

### **Add to Coach Navigation**:
```tsx
export const coachNavItems = [
  // ... existing items
  { label: "Withdrawals", href: "/coach/withdrawals" }, // NEW
];
```

---

## **5. Routes to Add**

### **In `App.tsx`**:
```tsx
// Client routes
<Route path="/client/credits" element={<ProtectedRoute allowedRoles={["client"]}><CreditPackages /></ProtectedRoute>} />
<Route path="/client/credits/success" element={<ProtectedRoute allowedRoles={["client"]}><CreditPurchaseSuccess /></ProtectedRoute>} />

// Coach routes
<Route path="/coach/withdrawals" element={<ProtectedRoute allowedRoles={["coach"]}><Withdrawals /></ProtectedRoute>} />
```

---

## **6. Environment Variables**

Ensure these are set in `.env`:
```env
VITE_SUPABASE_URL=https://vbrxgaxjmpwusbbbzzgl.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

And in Supabase Edge Function secrets:
```bash
supabase secrets set PAYCHANGU_SECRET_KEY=your_secret_key
supabase secrets set PAYCHANGU_WEBHOOK_SECRET=your_webhook_secret
supabase secrets set APP_BASE_URL=http://localhost:5173
```

---

## **7. Complete Flow Diagrams**

### **Credit Purchase Flow**:
```
Client → Browse Packages → Click Purchase
  ↓
purchase-credits Edge Function
  ↓
Create pending transaction
  ↓
Call PayChangu API
  ↓
Redirect to PayChangu Checkout
  ↓
Client completes payment
  ↓
PayChangu sends webhook → credits-webhook
  ↓
Update transaction to success
  ↓
Add credits to wallet
  ↓
Create credit transaction record
  ↓
Redirect client to success page
```

### **Course Enrollment Flow**:
```
Client → Browse Courses → Click Enroll
  ↓
Check if free or paid
  ↓
If paid: enroll-with-credits Edge Function
  ↓
Call transfer_credits database function
  ↓
Deduct credits from client wallet
  ↓
Add credits to coach wallet
  ↓
Create credit transactions (2 records)
  ↓
Create enrollment record
  ↓
Return success
```

### **Withdrawal Flow**:
```
Coach → Withdrawals Page → Enter amount
  ↓
request-withdrawal Edge Function
  ↓
Verify sufficient balance
  ↓
Deduct credits from wallet
  ↓
Create withdrawal request (pending)
  ↓
Create credit transaction record
  ↓
Admin processes request manually
  ↓
Update status to completed
  ↓
Send payment to coach
```

---

## **8. Testing Checklist**

### **Credit Purchase**:
- [ ] Can view credit packages
- [ ] Can initiate purchase
- [ ] Redirects to PayChangu
- [ ] Webhook processes payment
- [ ] Credits added to wallet
- [ ] Transaction recorded

### **Course Enrollment**:
- [ ] Free courses enroll without credits
- [ ] Paid courses show credit price
- [ ] Sufficient balance allows enrollment
- [ ] Insufficient balance shows error
- [ ] Credits transferred correctly
- [ ] Both wallets updated

### **Withdrawals**:
- [ ] Coach can view balance
- [ ] Can submit withdrawal request
- [ ] Credits deducted immediately
- [ ] Request shows as pending
- [ ] Transaction recorded
- [ ] Can view withdrawal history

---

## **9. Admin Features (Future)**

Create admin panel to:
- View all withdrawal requests
- Approve/reject requests
- Process payments
- View system-wide credit statistics
- Adjust conversion rates
- Manage credit packages

---

## **10. Security Considerations**

✅ **Implemented**:
- Webhook signature verification
- RLS policies on all tables
- Server-side credit transfers
- Transaction atomicity
- Balance validation

⚠️ **Additional Recommendations**:
- Rate limiting on Edge Functions
- Fraud detection for unusual patterns
- Email notifications for transactions
- Two-factor auth for withdrawals
- Audit logging for admin actions

---

## **Summary**

### **What's Done**:
✅ Database schema (migrated)
✅ 4 Edge Functions
✅ React hooks (useCredits)
✅ Documentation

### **What's Next**:
📋 Create UI components
📋 Add routes
📋 Update navigation
📋 Test end-to-end flows
📋 Deploy Edge Functions

The backend infrastructure is complete and ready to use! 🚀
