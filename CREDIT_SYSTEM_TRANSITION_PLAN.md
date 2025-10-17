# Credit-Based Payment System Transition Plan

## Executive Summary

This document provides a comprehensive analysis and implementation plan to transition from the current direct payment/subscription model to a credit-based token system for the coaching platform.

---

## 1. Current System Analysis

### 1.1 Overview of Current Payment Architecture

The application currently uses a **direct payment model** with the following characteristics:

#### Payment Flows
1. **Coach Subscriptions**: Coaches subscribe to platform tiers (Starter/Pro/Premium) via PayChangu
2. **Client One-Time Payments**: Clients pay coaches directly for individual courses
3. **Client Subscriptions**: Clients subscribe to coach-created packages

#### Technology Stack
- **Payment Gateway**: PayChangu (African payment processor)
- **Database**: Supabase (PostgreSQL)
- **Edge Functions**: Supabase Functions (Deno)
- **Frontend**: React + TypeScript

### 1.2 Database Schema - Current State

#### Core Payment Tables

##### 1. `tiers` - Platform Subscription Plans for Coaches
```sql
CREATE TABLE public.tiers (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2) NOT NULL,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_courses INTEGER,
  max_students INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

##### 2. `coach_subscriptions` - Coach Platform Subscriptions
```sql
CREATE TABLE public.coach_subscriptions (
  id UUID PRIMARY KEY,
  coach_id UUID NOT NULL,
  tier_id UUID NOT NULL REFERENCES public.tiers(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'pending')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ,
  renewal_date TIMESTAMPTZ,
  transaction_id TEXT,
  payment_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

##### 3. `coach_packages` - Coach-Created Subscription Packages
```sql
CREATE TABLE public.coach_packages (
  id UUID PRIMARY KEY,
  coach_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2) NOT NULL,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_clients INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

##### 4. `client_subscriptions` - Client Subscriptions to Coach Packages
```sql
CREATE TABLE public.client_subscriptions (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES auth.users(id),
  coach_id UUID NOT NULL REFERENCES auth.users(id),
  package_id UUID NOT NULL REFERENCES public.coach_packages(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'pending')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ,
  renewal_date TIMESTAMPTZ,
  transaction_id TEXT,
  payment_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

##### 5. `client_orders` - One-Time Course Purchases
```sql
CREATE TABLE public.client_orders (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL,
  coach_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('one_time', 'monthly', 'yearly')),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MWK',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  transaction_id TEXT,
  course_id UUID REFERENCES public.courses(id),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

##### 6. `transactions` - Payment Transaction Records
```sql
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  transaction_ref TEXT NOT NULL UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MWK',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),
  gateway_response JSONB,
  order_id UUID REFERENCES public.client_orders(id),
  subscription_id UUID REFERENCES public.coach_subscriptions(id),
  client_subscription_id UUID REFERENCES public.client_subscriptions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

##### 7. `invoices` - Payment Invoices
```sql
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  order_id UUID REFERENCES public.client_orders(id),
  subscription_id UUID REFERENCES public.coach_subscriptions(id),
  user_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MWK',
  invoice_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  payment_method TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

##### 8. `courses` - Course Content
```sql
CREATE TABLE public.courses (
  id UUID PRIMARY KEY,
  coach_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  status public.course_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

##### 9. `course_enrollments` - Student Course Access
```sql
CREATE TABLE public.course_enrollments (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.courses(id),
  status public.enrollment_status NOT NULL DEFAULT 'active',
  progress_percentage INTEGER NOT NULL DEFAULT 0,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, course_id)
);
```

### 1.3 Supabase Edge Functions

#### Function 1: `create-payment-link`
**Purpose**: Creates payment links for coach subscriptions, client one-time orders, and client subscriptions

**Key Logic**:
- Validates user roles (coach vs client)
- Creates pending records in respective tables
- Generates payment link via PayChangu API
- Supports coach-specific PayChangu accounts (via `coach_settings`)
- Cleans up pending records if payment initialization fails

**Request Modes**:
- `coach_subscription`: Coach subscribes to platform tier
- `client_one_time`: Client purchases individual course
- `client_subscription`: Client subscribes to coach package

#### Function 2: `paychangu-webhook`
**Purpose**: Handles payment completion callbacks from PayChangu

**Key Logic**:
- Verifies HMAC signature for security
- Updates transaction status
- Activates subscriptions (sets renewal dates)
- Marks orders as paid
- Creates invoices
- Handles both coach and client subscriptions

#### Function 3: `get-user-purchase-history`
**Purpose**: Retrieves user's payment history (invoices, orders, subscriptions, transactions)

### 1.4 Frontend Components

#### Payment Hooks (`usePayments.ts`)
- `createCoachSubscription()` - Create coach platform subscription
- `createClientOneTimeOrder()` - Create one-time course purchase
- `createClientSubscription()` - Create client subscription to coach package
- `getPurchaseHistory()` - Fetch user payment history
- `getClientSubscriptions()` - Fetch active client subscriptions
- `getCoachPackages()` - Fetch available coach packages

#### Billing Pages
- `/coach/billing` - Coach subscription management
- `/client/billing` - Client purchase and subscription management
- `/coach/billing/success` - Post-payment success page
- `/client/billing/success` - Post-payment success page

### 1.5 Current Payment Flow Diagram

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ 1. Initiates Payment
       │
       ▼
┌──────────────────────────┐
│ create-payment-link      │
│ (Supabase Function)      │
└───────┬──────────────────┘
        │
        │ 2. Creates Pending Record
        │    (order/subscription)
        │
        ▼
┌──────────────────────────┐
│ Database Tables          │
│ - transactions (pending) │
│ - client_orders          │
│ - subscriptions          │
└───────┬──────────────────┘
        │
        │ 3. Calls PayChangu API
        │
        ▼
┌──────────────────────────┐
│ PayChangu Gateway        │
└───────┬──────────────────┘
        │
        │ 4. Returns checkout_url
        │
        ▼
┌──────────────────────────┐
│ Client redirected to     │
│ PayChangu checkout page  │
└───────┬──────────────────┘
        │
        │ 5. Client completes payment
        │
        ▼
┌──────────────────────────┐
│ PayChangu sends webhook  │
│ to paychangu-webhook     │
└───────┬──────────────────┘
        │
        │ 6. Verifies signature
        │    Updates records
        │
        ▼
┌──────────────────────────┐
│ Database Updated:        │
│ - transaction: success   │
│ - subscription: active   │
│ - invoice created        │
└──────────────────────────┘
```

### 1.6 Key Issues with Current System

1. **No Flexibility**: Direct payment locks clients into specific services
2. **No Credit Accumulation**: Clients can't build up credits for future use
3. **Limited Coach Revenue Options**: Coaches can't easily offer credit-based packages
4. **No Withdrawal System**: Coaches receive money directly, no platform mediation
5. **Complex Subscription Management**: Multiple subscription types create complexity

---

## 2. Credit-Based System Design

### 2.1 Conceptual Overview

#### Core Principles
1. **Credits as Universal Currency**: All services priced in credits
2. **Client Credit Wallets**: Clients purchase and accumulate credits
3. **Coach Credit Earnings**: Coaches earn credits when clients enroll
4. **Withdrawal System**: Coaches can withdraw credits for real money
5. **Platform Fee Model**: Platform takes percentage on withdrawals

#### Benefits
- **Flexibility**: Clients can use credits across multiple coaches/courses
- **Better Cash Flow**: Platform controls money flow, can implement escrow
- **Revenue Model**: Platform earns commission on withdrawals
- **Reduced Complexity**: Single payment flow (credit purchase)
- **Enhanced User Experience**: Simplified enrollment process

### 2.2 New Database Schema

#### Table 1: `credit_packages` - Credit Purchase Options
```sql
CREATE TABLE public.credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  credits INTEGER NOT NULL, -- Number of credits
  price DECIMAL(10,2) NOT NULL, -- Real money price
  currency TEXT NOT NULL DEFAULT 'MWK',
  bonus_credits INTEGER DEFAULT 0, -- Bonus credits for bulk purchases
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX idx_credit_packages_active ON public.credit_packages(is_active, display_order);

-- Sample data
INSERT INTO public.credit_packages (name, description, credits, price, currency, bonus_credits, display_order) VALUES
  ('Starter Pack', '100 credits to get started', 100, 10000, 'MWK', 0, 1),
  ('Popular Pack', '500 credits + 50 bonus', 500, 45000, 'MWK', 50, 2),
  ('Pro Pack', '1000 credits + 150 bonus', 1000, 85000, 'MWK', 150, 3),
  ('Ultimate Pack', '5000 credits + 1000 bonus', 5000, 400000, 'MWK', 1000, 4);
```

#### Table 2: `user_credits` - User Credit Balances
```sql
CREATE TABLE public.user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0, -- Current credit balance
  total_earned INTEGER NOT NULL DEFAULT 0, -- Total credits earned (coaches)
  total_purchased INTEGER NOT NULL DEFAULT 0, -- Total credits purchased (clients)
  total_spent INTEGER NOT NULL DEFAULT 0, -- Total credits spent (clients)
  total_withdrawn INTEGER NOT NULL DEFAULT 0, -- Total credits withdrawn (coaches)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX idx_user_credits_user_id ON public.user_credits(user_id);
CREATE INDEX idx_user_credits_balance ON public.user_credits(balance);

-- Ensure balance never goes negative
ALTER TABLE public.user_credits ADD CONSTRAINT check_balance_non_negative CHECK (balance >= 0);
```

#### Table 3: `credit_transactions` - Credit Movement History
```sql
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'purchase',        -- Client buys credits
    'enrollment_payment', -- Client pays for enrollment
    'enrollment_earning', -- Coach receives credits from enrollment
    'refund',          -- Credit refund
    'withdrawal',      -- Coach withdraws credits
    'bonus',           -- Platform bonus/promotional credits
    'adjustment'       -- Admin adjustment
  )),
  amount INTEGER NOT NULL, -- Can be negative for debits
  balance_after INTEGER NOT NULL, -- Balance after transaction
  reference_type TEXT, -- 'credit_purchase', 'course_enrollment', 'withdrawal', etc.
  reference_id UUID, -- ID of related record
  description TEXT,
  metadata JSONB, -- Additional transaction details
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_type ON public.credit_transactions(transaction_type);
CREATE INDEX idx_credit_transactions_created ON public.credit_transactions(created_at DESC);
CREATE INDEX idx_credit_transactions_reference ON public.credit_transactions(reference_type, reference_id);
```

#### Table 4: `credit_purchases` - Credit Purchase Records
```sql
CREATE TABLE public.credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.credit_packages(id),
  credits_purchased INTEGER NOT NULL,
  bonus_credits INTEGER NOT NULL DEFAULT 0,
  total_credits INTEGER NOT NULL, -- credits_purchased + bonus_credits
  amount_paid DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MWK',
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_transaction_id UUID, -- References transactions table
  payment_ref TEXT, -- PayChangu transaction reference
  gateway_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_credit_purchases_user_id ON public.credit_purchases(user_id);
CREATE INDEX idx_credit_purchases_status ON public.credit_purchases(payment_status);
CREATE INDEX idx_credit_purchases_created ON public.credit_purchases(created_at DESC);
```

#### Table 5: `course_credit_pricing` - Course Credit Prices
```sql
CREATE TABLE public.course_credit_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  credit_price INTEGER NOT NULL, -- Price in credits
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id)
);

-- Index
CREATE INDEX idx_course_credit_pricing_course ON public.course_credit_pricing(course_id);
CREATE INDEX idx_course_credit_pricing_active ON public.course_credit_pricing(is_active);
```

#### Table 6: `coach_package_credit_pricing` - Package Credit Prices
```sql
CREATE TABLE public.coach_package_credit_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.coach_packages(id) ON DELETE CASCADE,
  credit_price_monthly INTEGER NOT NULL, -- Monthly price in credits
  credit_price_yearly INTEGER NOT NULL, -- Yearly price in credits
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(package_id)
);

-- Index
CREATE INDEX idx_package_credit_pricing_package ON public.coach_package_credit_pricing(package_id);
```

#### Table 7: `credit_withdrawals` - Coach Credit Withdrawals
```sql
CREATE TABLE public.credit_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_withdrawn INTEGER NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL, -- Amount in real money
  currency TEXT NOT NULL DEFAULT 'MWK',
  platform_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 10.00, -- Platform commission
  platform_fee_amount DECIMAL(10,2) NOT NULL,
  net_amount DECIMAL(10,2) NOT NULL, -- Amount after fees
  withdrawal_method TEXT NOT NULL, -- 'bank_transfer', 'mobile_money', 'paypal'
  withdrawal_details JSONB NOT NULL, -- Account details (encrypted)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  processed_at TIMESTAMPTZ,
  payment_proof_url TEXT, -- Receipt/proof of payment
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_credit_withdrawals_coach ON public.credit_withdrawals(coach_id);
CREATE INDEX idx_credit_withdrawals_status ON public.credit_withdrawals(status);
CREATE INDEX idx_credit_withdrawals_created ON public.credit_withdrawals(created_at DESC);
```

#### Table 8: `credit_enrollment_payments` - Course/Package Enrollment Credits
```sql
CREATE TABLE public.credit_enrollment_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_type TEXT NOT NULL CHECK (enrollment_type IN ('course', 'package')),
  enrollment_id UUID NOT NULL, -- References course_enrollments or client_subscriptions
  client_id UUID NOT NULL REFERENCES auth.users(id),
  coach_id UUID NOT NULL REFERENCES auth.users(id),
  credits_spent INTEGER NOT NULL,
  platform_fee_credits INTEGER NOT NULL DEFAULT 0, -- Platform commission in credits
  coach_credits_earned INTEGER NOT NULL, -- Credits coach receives
  course_id UUID REFERENCES public.courses(id),
  package_id UUID REFERENCES public.coach_packages(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_credit_enrollment_client ON public.credit_enrollment_payments(client_id);
CREATE INDEX idx_credit_enrollment_coach ON public.credit_enrollment_payments(coach_id);
CREATE INDEX idx_credit_enrollment_course ON public.credit_enrollment_payments(course_id);
CREATE INDEX idx_credit_enrollment_type ON public.credit_enrollment_payments(enrollment_type);
```

### 2.3 Database Functions for Credit System

#### Function 1: Add Credits to User Balance
```sql
CREATE OR REPLACE FUNCTION public.add_user_credits(
  _user_id UUID,
  _amount INTEGER,
  _transaction_type TEXT,
  _reference_type TEXT DEFAULT NULL,
  _reference_id UUID DEFAULT NULL,
  _description TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_balance INTEGER;
  _transaction_id UUID;
BEGIN
  -- Ensure user_credits record exists
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Update balance
  UPDATE public.user_credits
  SET 
    balance = balance + _amount,
    total_purchased = CASE WHEN _transaction_type = 'purchase' THEN total_purchased + _amount ELSE total_purchased END,
    total_earned = CASE WHEN _transaction_type = 'enrollment_earning' THEN total_earned + _amount ELSE total_earned END,
    updated_at = now()
  WHERE user_id = _user_id
  RETURNING balance INTO _new_balance;

  -- Record transaction
  INSERT INTO public.credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    reference_type,
    reference_id,
    description,
    metadata
  ) VALUES (
    _user_id,
    _transaction_type,
    _amount,
    _new_balance,
    _reference_type,
    _reference_id,
    _description,
    _metadata
  ) RETURNING id INTO _transaction_id;

  RETURN _transaction_id;
END;
$$;
```

#### Function 2: Deduct Credits from User Balance
```sql
CREATE OR REPLACE FUNCTION public.deduct_user_credits(
  _user_id UUID,
  _amount INTEGER,
  _transaction_type TEXT,
  _reference_type TEXT DEFAULT NULL,
  _reference_id UUID DEFAULT NULL,
  _description TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_balance INTEGER;
  _new_balance INTEGER;
  _transaction_id UUID;
BEGIN
  -- Check if user has sufficient balance
  SELECT balance INTO _current_balance
  FROM public.user_credits
  WHERE user_id = _user_id;

  IF _current_balance IS NULL THEN
    RAISE EXCEPTION 'User credit account not found';
  END IF;

  IF _current_balance < _amount THEN
    RAISE EXCEPTION 'Insufficient credit balance. Required: %, Available: %', _amount, _current_balance;
  END IF;

  -- Deduct balance
  UPDATE public.user_credits
  SET 
    balance = balance - _amount,
    total_spent = CASE WHEN _transaction_type = 'enrollment_payment' THEN total_spent + _amount ELSE total_spent END,
    total_withdrawn = CASE WHEN _transaction_type = 'withdrawal' THEN total_withdrawn + _amount ELSE total_withdrawn END,
    updated_at = now()
  WHERE user_id = _user_id
  RETURNING balance INTO _new_balance;

  -- Record transaction (negative amount for deduction)
  INSERT INTO public.credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    reference_type,
    reference_id,
    description,
    metadata
  ) VALUES (
    _user_id,
    _transaction_type,
    -_amount,
    _new_balance,
    _reference_type,
    _reference_id,
    _description,
    _metadata
  ) RETURNING id INTO _transaction_id;

  RETURN _transaction_id;
END;
$$;
```

#### Function 3: Get User Credit Balance
```sql
CREATE OR REPLACE FUNCTION public.get_user_credit_balance(_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _balance INTEGER;
BEGIN
  SELECT balance INTO _balance
  FROM public.user_credits
  WHERE user_id = _user_id;

  RETURN COALESCE(_balance, 0);
END;
$$;
```

#### Function 4: Process Course Enrollment with Credits
```sql
CREATE OR REPLACE FUNCTION public.enroll_course_with_credits(
  _user_id UUID,
  _course_id UUID,
  _platform_fee_percentage DECIMAL DEFAULT 10.00
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _credit_price INTEGER;
  _coach_id UUID;
  _enrollment_id UUID;
  _payment_id UUID;
  _platform_fee_credits INTEGER;
  _coach_credits INTEGER;
BEGIN
  -- Get course details and credit price
  SELECT c.coach_id, cp.credit_price INTO _coach_id, _credit_price
  FROM public.courses c
  JOIN public.course_credit_pricing cp ON cp.course_id = c.id
  WHERE c.id = _course_id AND c.status = 'published' AND cp.is_active = true;

  IF _credit_price IS NULL THEN
    RAISE EXCEPTION 'Course not found or credit pricing not configured';
  END IF;

  -- Check for existing enrollment
  IF EXISTS (SELECT 1 FROM public.course_enrollments WHERE user_id = _user_id AND course_id = _course_id) THEN
    RAISE EXCEPTION 'User already enrolled in this course';
  END IF;

  -- Calculate fees
  _platform_fee_credits := FLOOR(_credit_price * _platform_fee_percentage / 100);
  _coach_credits := _credit_price - _platform_fee_credits;

  -- Deduct credits from client
  PERFORM public.deduct_user_credits(
    _user_id,
    _credit_price,
    'enrollment_payment',
    'course_enrollment',
    _course_id,
    'Course enrollment: ' || _course_id::TEXT,
    jsonb_build_object('coach_id', _coach_id, 'credit_price', _credit_price)
  );

  -- Add credits to coach
  PERFORM public.add_user_credits(
    _coach_id,
    _coach_credits,
    'enrollment_earning',
    'course_enrollment',
    _course_id,
    'Course enrollment earnings: ' || _course_id::TEXT,
    jsonb_build_object('client_id', _user_id, 'gross_credits', _credit_price, 'platform_fee', _platform_fee_credits)
  );

  -- Create enrollment
  INSERT INTO public.course_enrollments (user_id, course_id, status)
  VALUES (_user_id, _course_id, 'active')
  RETURNING id INTO _enrollment_id;

  -- Record payment
  INSERT INTO public.credit_enrollment_payments (
    enrollment_type,
    enrollment_id,
    client_id,
    coach_id,
    credits_spent,
    platform_fee_credits,
    coach_credits_earned,
    course_id
  ) VALUES (
    'course',
    _enrollment_id,
    _user_id,
    _coach_id,
    _credit_price,
    _platform_fee_credits,
    _coach_credits,
    _course_id
  ) RETURNING id INTO _payment_id;

  RETURN _enrollment_id;
END;
$$;
```

### 2.4 Row Level Security (RLS) Policies

```sql
-- Enable RLS on all new tables
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_credit_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_package_credit_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_enrollment_payments ENABLE ROW LEVEL SECURITY;

-- Credit Packages Policies
CREATE POLICY "Anyone can view active credit packages"
  ON public.credit_packages FOR SELECT
  USING (is_active = true OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can manage credit packages"
  ON public.credit_packages FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- User Credits Policies
CREATE POLICY "Users can view their own credit balance"
  ON public.user_credits FOR SELECT
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "System can manage user credits"
  ON public.user_credits FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Credit Transactions Policies
CREATE POLICY "Users can view their own credit transactions"
  ON public.credit_transactions FOR SELECT
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "System can create credit transactions"
  ON public.credit_transactions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Credit Purchases Policies
CREATE POLICY "Users can view their own credit purchases"
  ON public.credit_purchases FOR SELECT
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create credit purchases"
  ON public.credit_purchases FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Course Credit Pricing Policies
CREATE POLICY "Anyone can view active course credit pricing"
  ON public.course_credit_pricing FOR SELECT
  USING (is_active = true OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Coaches can manage their course credit pricing"
  ON public.course_credit_pricing FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = course_credit_pricing.course_id
      AND (courses.coach_id = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );

-- Credit Withdrawals Policies
CREATE POLICY "Coaches can view their own withdrawals"
  ON public.credit_withdrawals FOR SELECT
  USING (coach_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Coaches can create withdrawal requests"
  ON public.credit_withdrawals FOR INSERT
  WITH CHECK (coach_id = auth.uid() AND has_role(auth.uid(), 'coach'));

CREATE POLICY "Only admins can update withdrawals"
  ON public.credit_withdrawals FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Credit Enrollment Payments Policies
CREATE POLICY "Users can view their enrollment payments"
  ON public.credit_enrollment_payments FOR SELECT
  USING (
    client_id = auth.uid() 
    OR coach_id = auth.uid() 
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "System can create enrollment payments"
  ON public.credit_enrollment_payments FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') OR client_id = auth.uid());
```

### 2.5 Updated Supabase Edge Functions

#### New Function: `purchase-credits`
**File**: `supabase/functions/purchase-credits/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const paychanguSecret = Deno.env.get("PAYCHANGU_SECRET_KEY");
    const appBaseUrl = Deno.env.get("APP_BASE_URL");
    
    if (!supabaseUrl || !supabaseKey || !paychanguSecret) {
      throw new Error("Missing environment configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Parse request
    const body = await req.json();
    const { package_id, currency = "MWK" } = body;

    if (!package_id) {
      throw new Error("package_id is required");
    }

    // Get credit package details
    const { data: creditPackage, error: packageError } = await supabase
      .from("credit_packages")
      .select("*")
      .eq("id", package_id)
      .eq("is_active", true)
      .single();

    if (packageError || !creditPackage) {
      throw new Error("Credit package not found");
    }

    // Create credit purchase record (pending)
    const { data: purchase, error: purchaseError } = await supabase
      .from("credit_purchases")
      .insert({
        user_id: user.id,
        package_id: creditPackage.id,
        credits_purchased: creditPackage.credits,
        bonus_credits: creditPackage.bonus_credits,
        total_credits: creditPackage.credits + creditPackage.bonus_credits,
        amount_paid: creditPackage.price,
        currency: currency,
        payment_status: "pending",
      })
      .select()
      .single();

    if (purchaseError || !purchase) {
      throw new Error("Failed to create purchase record");
    }

    // Create transaction reference
    const tx_ref = `CREDIT_${purchase.id}`;

    // Create transaction record
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        transaction_ref: tx_ref,
        amount: creditPackage.price,
        currency: currency,
        status: "pending",
        gateway_response: null,
        order_id: null,
        subscription_id: null,
      })
      .select()
      .single();

    if (txError || !transaction) {
      // Clean up purchase record
      await supabase.from("credit_purchases").delete().eq("id", purchase.id);
      throw new Error("Failed to create transaction");
    }

    // Update purchase with transaction ID
    await supabase
      .from("credit_purchases")
      .update({ payment_transaction_id: transaction.id, payment_ref: tx_ref })
      .eq("id", purchase.id);

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .single();

    // Create PayChangu payment
    const callbackUrl = Deno.env.get("PAYCHANGU_WEBHOOK_URL") || 
      `${supabaseUrl}/functions/v1/paychangu-webhook`;
    const returnUrl = `${appBaseUrl}/client/credits/success`;

    const first_name = profile?.full_name?.split(" ")[0] || "";
    const last_name = profile?.full_name?.split(" ").slice(1).join(" ") || "";

    const payPayload = {
      amount: String(creditPackage.price),
      currency,
      email: profile?.email || user.email,
      first_name,
      last_name,
      callback_url: callbackUrl,
      return_url: returnUrl,
      tx_ref,
      customization: {
        title: "Experts Coaching Hub - Credit Purchase",
        description: `Purchase ${creditPackage.name}: ${creditPackage.credits + creditPackage.bonus_credits} credits`,
      },
      meta: {
        mode: "credit_purchase",
        purchase_id: purchase.id,
        user_id: user.id,
        credits: creditPackage.credits + creditPackage.bonus_credits,
      },
    };

    const resp = await fetch("https://api.paychangu.com/payment", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${paychanguSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payPayload),
    });

    const data = await resp.json();

    if (!resp.ok || data.status !== "success" || !data.data?.checkout_url) {
      // Payment initialization failed - clean up
      await supabase.from("transactions").update({ status: "failed" }).eq("id", transaction.id);
      await supabase.from("credit_purchases").delete().eq("id", purchase.id);
      
      return new Response(JSON.stringify({
        error: "Failed to initialize payment",
        details: data,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      checkout_url: data.data.checkout_url,
      transaction_ref: tx_ref,
      purchase_id: purchase.id,
      credits: creditPackage.credits + creditPackage.bonus_credits,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
```

#### Updated Function: `paychangu-webhook`
**Updates needed**: Handle credit purchase completion

```typescript
// Add to existing webhook handler after line 113:

// Handle credit purchase
if (payload.meta?.mode === "credit_purchase" && success) {
  const purchase_id = payload.meta.purchase_id;
  
  // Update purchase status
  const { data: purchase, error: purchaseErr } = await supabase
    .from("credit_purchases")
    .update({ payment_status: "completed", gateway_response: payload })
    .eq("id", purchase_id)
    .select()
    .single();

  if (!purchaseErr && purchase) {
    // Add credits to user account
    await supabase.rpc("add_user_credits", {
      _user_id: purchase.user_id,
      _amount: purchase.total_credits,
      _transaction_type: "purchase",
      _reference_type: "credit_purchase",
      _reference_id: purchase.id,
      _description: `Purchased ${purchase.total_credits} credits`,
      _metadata: {
        package_id: purchase.package_id,
        amount_paid: purchase.amount_paid,
        currency: purchase.currency
      }
    });

    console.log(`Added ${purchase.total_credits} credits to user ${purchase.user_id}`);
  }
}
```

#### New Function: `enroll-with-credits`
**File**: `supabase/functions/enroll-with-credits/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing environment configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Parse request
    const body = await req.json();
    const { course_id } = body;

    if (!course_id) {
      throw new Error("course_id is required");
    }

    // Call enrollment function
    const { data: enrollmentId, error: enrollError } = await supabase
      .rpc("enroll_course_with_credits", {
        _user_id: user.id,
        _course_id: course_id,
        _platform_fee_percentage: 10.00
      });

    if (enrollError) {
      throw new Error(enrollError.message);
    }

    return new Response(JSON.stringify({
      success: true,
      enrollment_id: enrollmentId,
      message: "Successfully enrolled in course"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
```

#### New Function: `request-withdrawal`
**File**: `supabase/functions/request-withdrawal/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_FEE_PERCENTAGE = 10.00; // 10% platform fee
const CREDIT_TO_MONEY_RATE = 100; // 1 credit = 100 MWK (configurable)

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing environment configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Verify user is a coach
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleRow?.role !== "coach") {
      return new Response(JSON.stringify({ error: "Only coaches can request withdrawals" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Parse request
    const body = await req.json();
    const { 
      credits_to_withdraw, 
      withdrawal_method, 
      withdrawal_details,
      currency = "MWK"
    } = body;

    if (!credits_to_withdraw || !withdrawal_method || !withdrawal_details) {
      throw new Error("Missing required fields");
    }

    // Get user credit balance
    const { data: userCredits } = await supabase
      .from("user_credits")
      .select("balance")
      .eq("user_id", user.id)
      .single();

    if (!userCredits || userCredits.balance < credits_to_withdraw) {
      return new Response(JSON.stringify({ 
        error: "Insufficient credit balance",
        current_balance: userCredits?.balance || 0,
        requested: credits_to_withdraw
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Calculate amounts
    const amount_before_fees = credits_to_withdraw * CREDIT_TO_MONEY_RATE;
    const platform_fee_amount = amount_before_fees * PLATFORM_FEE_PERCENTAGE / 100;
    const net_amount = amount_before_fees - platform_fee_amount;

    // Create withdrawal request
    const { data: withdrawal, error: withdrawalError } = await supabase
      .from("credit_withdrawals")
      .insert({
        coach_id: user.id,
        credits_withdrawn: credits_to_withdraw,
        amount_paid: amount_before_fees,
        currency: currency,
        platform_fee_percentage: PLATFORM_FEE_PERCENTAGE,
        platform_fee_amount: platform_fee_amount,
        net_amount: net_amount,
        withdrawal_method: withdrawal_method,
        withdrawal_details: withdrawal_details, // Should be encrypted in production
        status: "pending"
      })
      .select()
      .single();

    if (withdrawalError || !withdrawal) {
      throw new Error("Failed to create withdrawal request");
    }

    // Deduct credits immediately (held in withdrawal)
    const { error: deductError } = await supabase.rpc("deduct_user_credits", {
      _user_id: user.id,
      _amount: credits_to_withdraw,
      _transaction_type: "withdrawal",
      _reference_type: "credit_withdrawal",
      _reference_id: withdrawal.id,
      _description: `Withdrawal request: ${credits_to_withdraw} credits`,
      _metadata: {
        withdrawal_method: withdrawal_method,
        net_amount: net_amount,
        platform_fee: platform_fee_amount
      }
    });

    if (deductError) {
      // Rollback withdrawal record
      await supabase.from("credit_withdrawals").delete().eq("id", withdrawal.id);
      throw new Error(deductError.message);
    }

    return new Response(JSON.stringify({
      success: true,
      withdrawal_id: withdrawal.id,
      credits_withdrawn: credits_to_withdraw,
      amount_before_fees: amount_before_fees,
      platform_fee: platform_fee_amount,
      net_amount: net_amount,
      currency: currency,
      status: "pending",
      message: "Withdrawal request submitted successfully. It will be processed within 3-5 business days."
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
```

### 2.6 Frontend Updates

#### Updated Hook: `useCredits.ts`
**File**: `src/hooks/useCredits.ts`

```typescript
import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callSupabaseFunction } from "@/lib/supabaseFunctions";

export function useCredits() {
  // Get user credit balance
  const getCreditBalance = useCallback(async () => {
    const { data, error } = await supabase
      .from("user_credits")
      .select("*")
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data || { balance: 0, total_earned: 0, total_purchased: 0, total_spent: 0 };
  }, []);

  // Get credit packages
  const getCreditPackages = useCallback(async () => {
    const { data, error } = await supabase
      .from("credit_packages")
      .select("*")
      .eq("is_active", true)
      .order("display_order");

    if (error) throw error;
    return data;
  }, []);

  // Purchase credits
  const purchaseCredits = useCallback(async (packageId: string, currency?: string) => {
    return await callSupabaseFunction("purchase-credits", { 
      package_id: packageId, 
      currency 
    });
  }, []);

  // Enroll in course with credits
  const enrollWithCredits = useCallback(async (courseId: string) => {
    return await callSupabaseFunction("enroll-with-credits", { 
      course_id: courseId 
    });
  }, []);

  // Get credit transaction history
  const getCreditTransactions = useCallback(async () => {
    const { data, error } = await supabase
      .from("credit_transactions")
      .select("*")
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return data;
  }, []);

  // Request credit withdrawal (coaches)
  const requestWithdrawal = useCallback(async (
    creditsToWithdraw: number,
    withdrawalMethod: string,
    withdrawalDetails: any
  ) => {
    return await callSupabaseFunction("request-withdrawal", {
      credits_to_withdraw: creditsToWithdraw,
      withdrawal_method: withdrawalMethod,
      withdrawal_details: withdrawalDetails
    });
  }, []);

  // Get withdrawal history (coaches)
  const getWithdrawalHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from("credit_withdrawals")
      .select("*")
      .eq("coach_id", (await supabase.auth.getUser()).data.user?.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  }, []);

  return {
    getCreditBalance,
    getCreditPackages,
    purchaseCredits,
    enrollWithCredits,
    getCreditTransactions,
    requestWithdrawal,
    getWithdrawalHistory,
  };
}
```

#### New Component: `CreditBalance.tsx`
**File**: `src/components/CreditBalance.tsx`

```typescript
import { useQuery } from "@tanstack/react-query";
import { useCredits } from "@/hooks/useCredits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins } from "lucide-react";

export function CreditBalance() {
  const { getCreditBalance } = useCredits();

  const { data: credits, isLoading } = useQuery({
    queryKey: ["credit_balance"],
    queryFn: getCreditBalance,
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Credit Balance</CardTitle>
        <Coins className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{credits?.balance || 0} Credits</div>
        <p className="text-xs text-muted-foreground mt-1">
          Available for courses and packages
        </p>
      </CardContent>
    </Card>
  );
}
```

---

## 3. Migration Strategy

### 3.1 Phased Migration Approach

#### Phase 1: Parallel System (Weeks 1-4)
- Deploy credit tables alongside existing payment tables
- Keep both systems operational
- Add credit purchasing functionality
- Allow credit-based enrollments
- Monitor adoption and fix bugs

#### Phase 2: Transition Period (Weeks 5-8)
- Encourage users to switch to credit system (via UI prompts, discounts)
- Migrate existing subscriptions to credit-based model
- Deprecate old payment flows (show warnings)
- Data migration scripts for historical data

#### Phase 3: Full Cutover (Weeks 9-12)
- Disable old payment flows completely
- Remove deprecated tables (after backup)
- Finalize UI/UX for credit system
- Complete documentation

### 3.2 Migration Scripts

#### Script 1: Create Credit System Tables
**File**: `supabase/migrations/[TIMESTAMP]_create_credit_system.sql`

```sql
-- All the CREATE TABLE statements from section 2.2
-- All the CREATE FUNCTION statements from section 2.3
-- All the RLS policies from section 2.4
```

#### Script 2: Seed Initial Data
**File**: `supabase/migrations/[TIMESTAMP]_seed_credit_packages.sql`

```sql
-- Insert default credit packages
INSERT INTO public.credit_packages (name, description, credits, price, currency, bonus_credits, display_order) VALUES
  ('Starter Pack', '100 credits to get started', 100, 10000, 'MWK', 0, 1),
  ('Popular Pack', '500 credits + 50 bonus', 500, 45000, 'MWK', 50, 2),
  ('Pro Pack', '1000 credits + 150 bonus', 1000, 85000, 'MWK', 150, 3),
  ('Ultimate Pack', '5000 credits + 1000 bonus', 5000, 400000, 'MWK', 1000, 4);

-- Set default credit prices for existing courses
INSERT INTO public.course_credit_pricing (course_id, credit_price, is_active)
SELECT id, 50, true -- Default: 50 credits per course
FROM public.courses
WHERE status = 'published';
```

#### Script 3: Migrate Historical Data (Optional)
**File**: `supabase/migrations/[TIMESTAMP]_migrate_historical_data.sql`

```sql
-- Create user_credits records for all existing users
INSERT INTO public.user_credits (user_id, balance, total_earned, total_purchased, total_spent)
SELECT 
  id, 
  0 as balance,
  0 as total_earned,
  0 as total_purchased,
  0 as total_spent
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Give coaches credits based on their historical earnings (optional conversion)
-- This is a business decision - you could grant them credits equal to their past revenue
UPDATE public.user_credits uc
SET 
  balance = balance + COALESCE(earnings.total_credits, 0),
  total_earned = total_earned + COALESCE(earnings.total_credits, 0)
FROM (
  SELECT 
    co.coach_id,
    SUM(co.amount / 100) as total_credits -- Assuming 100 MWK = 1 credit
  FROM public.client_orders co
  WHERE co.status = 'completed'
  GROUP BY co.coach_id
) earnings
WHERE uc.user_id = earnings.coach_id
AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = uc.user_id AND role = 'coach');
```

### 3.3 Rollback Plan

```sql
-- Rollback script in case migration fails
-- File: supabase/migrations/[TIMESTAMP]_rollback_credit_system.sql

-- Drop all credit system tables in reverse order
DROP TABLE IF EXISTS public.credit_enrollment_payments CASCADE;
DROP TABLE IF EXISTS public.credit_withdrawals CASCADE;
DROP TABLE IF EXISTS public.coach_package_credit_pricing CASCADE;
DROP TABLE IF EXISTS public.course_credit_pricing CASCADE;
DROP TABLE IF EXISTS public.credit_purchases CASCADE;
DROP TABLE IF EXISTS public.credit_transactions CASCADE;
DROP TABLE IF EXISTS public.user_credits CASCADE;
DROP TABLE IF EXISTS public.credit_packages CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS public.add_user_credits CASCADE;
DROP FUNCTION IF EXISTS public.deduct_user_credits CASCADE;
DROP FUNCTION IF EXISTS public.get_user_credit_balance CASCADE;
DROP FUNCTION IF EXISTS public.enroll_course_with_credits CASCADE;
```

---

## 4. Implementation Checklist

### 4.1 Database Tasks
- [ ] Create migration file with all new tables
- [ ] Create database functions (add_user_credits, deduct_user_credits, etc.)
- [ ] Set up RLS policies for all new tables
- [ ] Seed initial credit packages
- [ ] Set default credit prices for existing courses
- [ ] Create indexes for performance
- [ ] Test all database functions in staging environment

### 4.2 Backend Tasks
- [ ] Create `purchase-credits` Supabase function
- [ ] Create `enroll-with-credits` Supabase function
- [ ] Create `request-withdrawal` Supabase function
- [ ] Update `paychangu-webhook` to handle credit purchases
- [ ] Create admin function to approve/process withdrawals
- [ ] Add environment variables for credit conversion rates
- [ ] Test all edge functions with mock data
- [ ] Set up error handling and logging

### 4.3 Frontend Tasks
- [ ] Create `useCredits` hook
- [ ] Create `CreditBalance` component
- [ ] Create credit purchase page (`/client/credits/purchase`)
- [ ] Create credit history page (`/client/credits/history`)
- [ ] Create withdrawal request page (`/coach/withdrawals`)
- [ ] Update course enrollment flow to use credits
- [ ] Update package subscription flow to use credits
- [ ] Add credit balance display in navigation/dashboard
- [ ] Create success pages for credit purchases
- [ ] Add credit pricing display on course/package cards
- [ ] Update billing pages to show credit transactions

### 4.4 Testing Tasks
- [ ] Unit tests for database functions
- [ ] Integration tests for edge functions
- [ ] End-to-end tests for credit purchase flow
- [ ] End-to-end tests for enrollment with credits
- [ ] End-to-end tests for withdrawal flow
- [ ] Load testing for concurrent credit transactions
- [ ] Security testing (SQL injection, authorization bypass)
- [ ] Test insufficient balance scenarios
- [ ] Test webhook signature verification
- [ ] Test rollback scenarios

### 4.5 Documentation Tasks
- [ ] Update API documentation
- [ ] Create user guide for credit system
- [ ] Create coach guide for withdrawals
- [ ] Update environment variable documentation
- [ ] Create troubleshooting guide
- [ ] Document migration process
- [ ] Create admin dashboard documentation

---

## 5. Security Considerations

### 5.1 Critical Security Measures

#### 1. Credit Balance Protection
```sql
-- Ensure credits cannot go negative
ALTER TABLE public.user_credits 
ADD CONSTRAINT check_balance_non_negative CHECK (balance >= 0);

-- Use row-level locking for concurrent transactions
-- Already handled in deduct_user_credits function with atomic operations
```

#### 2. Withdrawal Details Encryption
**Recommendation**: Encrypt sensitive withdrawal details before storing

```typescript
// In request-withdrawal function, add encryption:
import { encrypt } from "https://deno.land/x/encryption@1.0.0/mod.ts";

const encryptedDetails = await encrypt(
  JSON.stringify(withdrawal_details),
  Deno.env.get("ENCRYPTION_KEY")
);

// Store encryptedDetails instead of plain withdrawal_details
```

#### 3. Webhook Signature Verification
**Already implemented**: HMAC-SHA256 verification in paychangu-webhook function

#### 4. Rate Limiting
**Recommendation**: Add rate limiting to prevent abuse

```typescript
// Add to Supabase function headers
const rateLimitCheck = async (userId: string, action: string) => {
  const { count } = await supabase
    .from("rate_limits")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .eq("action", action)
    .gte("created_at", new Date(Date.now() - 3600000).toISOString()); // Last hour
  
  if (count > 10) { // Max 10 requests per hour
    throw new Error("Rate limit exceeded");
  }
};
```

#### 5. Double-Spending Prevention
**Already handled**: Atomic database operations with `SELECT FOR UPDATE` implicit in Postgres

#### 6. Admin Approval for Withdrawals
**Implemented**: Withdrawals have `status` field requiring admin approval

### 5.2 Audit Trail

```sql
-- All credit movements are logged in credit_transactions table
-- This provides complete audit trail

-- Query for suspicious activity
SELECT 
  user_id,
  transaction_type,
  SUM(amount) as total_amount,
  COUNT(*) as transaction_count
FROM public.credit_transactions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id, transaction_type
HAVING SUM(amount) > 10000 OR COUNT(*) > 50;
```

---

## 6. Scalability Recommendations

### 6.1 Database Optimization

#### Partitioning for Large Tables
```sql
-- Partition credit_transactions by month for better performance
CREATE TABLE credit_transactions_2024_01 
  PARTITION OF credit_transactions 
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE credit_transactions_2024_02 
  PARTITION OF credit_transactions 
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- And so on...
```

#### Indexes for Performance
```sql
-- Already included in schema, but ensure monitoring:
CREATE INDEX CONCURRENTLY idx_credit_trans_user_created 
  ON public.credit_transactions(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_user_credits_updated 
  ON public.user_credits(updated_at DESC);
```

### 6.2 Caching Strategy

```typescript
// Cache credit balance in Redis (if using)
const getCachedBalance = async (userId: string) => {
  const cached = await redis.get(`credit_balance:${userId}`);
  if (cached) return JSON.parse(cached);
  
  const balance = await supabase.rpc("get_user_credit_balance", { _user_id: userId });
  await redis.setex(`credit_balance:${userId}`, 300, JSON.stringify(balance)); // 5 min cache
  
  return balance;
};
```

### 6.3 Background Jobs

**Recommendation**: Use Supabase Edge Functions with scheduled triggers

```sql
-- Create periodic cleanup jobs
-- 1. Archive old transactions (older than 1 year)
-- 2. Send withdrawal reminder emails to coaches
-- 3. Generate monthly credit usage reports
```

---

## 7. Testing Scenarios

### 7.1 Critical Test Cases

#### Test Case 1: Credit Purchase
```
1. User selects credit package
2. System creates pending purchase record
3. User redirected to PayChangu
4. User completes payment
5. Webhook received and verified
6. Credits added to user balance
7. Purchase status updated to "completed"
8. Transaction recorded in history

Expected: User balance increases by purchased + bonus credits
```

#### Test Case 2: Insufficient Balance
```
1. User attempts to enroll in course
2. Course costs 100 credits
3. User has 50 credits
4. System checks balance before enrollment
5. Error returned: "Insufficient credit balance"

Expected: Enrollment fails, balance unchanged
```

#### Test Case 3: Concurrent Enrollment
```
1. User A has 100 credits
2. User A clicks "Enroll" on Course X (100 credits) - Tab 1
3. User A clicks "Enroll" on Course Y (100 credits) - Tab 2
4. Both requests arrive simultaneously
5. Database lock ensures only one succeeds
6. Second request fails with insufficient balance

Expected: Only one enrollment succeeds
```

#### Test Case 4: Coach Withdrawal
```
1. Coach requests withdrawal of 1000 credits
2. System verifies balance (must have >= 1000)
3. Credits deducted immediately
4. Withdrawal request created (status: pending)
5. Admin approves withdrawal
6. Payment processed
7. Withdrawal status updated to "completed"

Expected: Coach balance reduced, withdrawal processed
```

#### Test Case 5: Failed Payment Cleanup
```
1. User initiates credit purchase
2. Pending purchase record created
3. Payment initialization fails (PayChangu error)
4. System automatically deletes pending purchase
5. No transaction recorded

Expected: No orphaned records in database
```

### 7.2 Performance Testing

```bash
# Load test for credit purchase
ab -n 1000 -c 10 -H "Authorization: Bearer TOKEN" \
  -p purchase.json \
  https://YOUR_PROJECT.supabase.co/functions/v1/purchase-credits

# Concurrent enrollment test
for i in {1..100}; do
  curl -X POST \
    -H "Authorization: Bearer TOKEN" \
    -d '{"course_id":"COURSE_ID"}' \
    https://YOUR_PROJECT.supabase.co/functions/v1/enroll-with-credits &
done
wait
```

---

## 8. Potential Pitfalls & Mitigation

### 8.1 Common Issues

| Issue | Risk Level | Mitigation |
|-------|-----------|------------|
| **Race Conditions** | HIGH | Use database transactions with row-level locking |
| **Double-Spending** | HIGH | Atomic operations, balance constraints |
| **Webhook Replay Attacks** | MEDIUM | Store processed transaction refs, check duplicates |
| **Credit Price Changes** | MEDIUM | Version pricing, honor prices at enrollment time |
| **Orphaned Records** | LOW | Cleanup logic in payment failure scenarios |
| **Insufficient Balance** | LOW | Pre-check balance before operations |
| **Withdrawal Fraud** | HIGH | Manual admin approval, identity verification |
| **Currency Conversion Errors** | MEDIUM | Use fixed rates, store rate at transaction time |

### 8.2 Edge Cases

#### 1. Partial Credit Refunds
```sql
-- Function to handle partial refunds
CREATE OR REPLACE FUNCTION public.refund_enrollment_credits(
  _enrollment_id UUID,
  _refund_percentage DECIMAL DEFAULT 100.00
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _payment RECORD;
  _refund_credits INTEGER;
BEGIN
  -- Get original payment
  SELECT * INTO _payment
  FROM public.credit_enrollment_payments
  WHERE enrollment_id = _enrollment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment payment not found';
  END IF;

  -- Calculate refund amount
  _refund_credits := FLOOR(_payment.credits_spent * _refund_percentage / 100);

  -- Add credits back to client
  PERFORM public.add_user_credits(
    _payment.client_id,
    _refund_credits,
    'refund',
    'course_enrollment',
    _enrollment_id,
    FORMAT('Refund: %s%% of %s credits', _refund_percentage, _payment.credits_spent),
    jsonb_build_object('original_credits', _payment.credits_spent, 'refund_percentage', _refund_percentage)
  );

  -- Deduct from coach (if they haven't withdrawn yet)
  PERFORM public.deduct_user_credits(
    _payment.coach_id,
    _refund_credits,
    'refund',
    'course_enrollment',
    _enrollment_id,
    FORMAT('Refund deduction: %s credits', _refund_credits),
    jsonb_build_object('client_id', _payment.client_id, 'refund_percentage', _refund_percentage)
  );
END;
$$;
```

#### 2. Credit Expiration (Optional Feature)
```sql
-- Add expiration tracking to user_credits
ALTER TABLE public.user_credits 
ADD COLUMN expiring_credits INTEGER DEFAULT 0,
ADD COLUMN next_expiration_date TIMESTAMPTZ;

-- Function to expire credits
CREATE OR REPLACE FUNCTION public.expire_old_credits()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Deduct expired credits
  UPDATE public.user_credits
  SET 
    balance = balance - expiring_credits,
    expiring_credits = 0,
    next_expiration_date = NULL
  WHERE next_expiration_date <= NOW()
  AND expiring_credits > 0;

  -- Log expirations
  INSERT INTO public.credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    description
  )
  SELECT 
    user_id,
    'adjustment',
    -expiring_credits,
    balance,
    'Credit expiration'
  FROM public.user_credits
  WHERE next_expiration_date <= NOW();
END;
$$;
```

---

## 9. Summary of Affected Files

### 9.1 Database Migrations
```
supabase/migrations/
  └── [TIMESTAMP]_create_credit_system.sql (NEW)
  └── [TIMESTAMP]_seed_credit_packages.sql (NEW)
  └── [TIMESTAMP]_migrate_historical_data.sql (NEW - Optional)
```

### 9.2 Supabase Edge Functions
```
supabase/functions/
  ├── purchase-credits/ (NEW)
  │   └── index.ts
  ├── enroll-with-credits/ (NEW)
  │   └── index.ts
  ├── request-withdrawal/ (NEW)
  │   └── index.ts
  ├── paychangu-webhook/ (MODIFIED)
  │   └── index.ts (add credit purchase handling)
  └── get-user-purchase-history/ (MODIFIED - Optional)
      └── index.ts (add credit transaction history)
```

### 9.3 Frontend Files
```
src/
  ├── hooks/
  │   └── useCredits.ts (NEW)
  ├── components/
  │   ├── CreditBalance.tsx (NEW)
  │   ├── CreditPackageCard.tsx (NEW)
  │   └── WithdrawalRequestForm.tsx (NEW)
  ├── pages/
  │   ├── client/
  │   │   ├── CreditsPurchase.tsx (NEW)
  │   │   ├── CreditsHistory.tsx (NEW)
  │   │   ├── CreditsSuccess.tsx (NEW)
  │   │   └── Courses.tsx (MODIFIED - add credit pricing)
  │   └── coach/
  │       ├── Withdrawals.tsx (NEW)
  │       ├── WithdrawalHistory.tsx (NEW)
  │       └── CoachDashboard.tsx (MODIFIED - add earnings display)
  └── integrations/
      └── supabase/
          └── types.ts (MODIFIED - add new table types)
```

### 9.4 Configuration Files
```
.env (MODIFIED - add new variables)
  CREDIT_TO_MONEY_CONVERSION_RATE=100
  PLATFORM_FEE_PERCENTAGE=10.00
  ENCRYPTION_KEY=<secret>
```

---

## 10. Next Steps & Timeline

### Week 1-2: Foundation
- [ ] Create and test database migrations
- [ ] Deploy credit tables to staging
- [ ] Implement core database functions
- [ ] Set up RLS policies
- [ ] Create seed data

### Week 3-4: Backend Development
- [ ] Develop `purchase-credits` function
- [ ] Develop `enroll-with-credits` function
- [ ] Develop `request-withdrawal` function
- [ ] Update webhook handler
- [ ] Test all functions in staging

### Week 5-6: Frontend Development
- [ ] Create `useCredits` hook
- [ ] Build credit purchase flow
- [ ] Build enrollment with credits flow
- [ ] Build withdrawal request flow
- [ ] Update existing pages

### Week 7-8: Testing & QA
- [ ] Comprehensive testing (unit, integration, E2E)
- [ ] Security audit
- [ ] Performance testing
- [ ] Bug fixes

### Week 9-10: Deployment & Migration
- [ ] Deploy to production
- [ ] Run data migration scripts
- [ ] Monitor system performance
- [ ] User support and bug fixes

### Week 11-12: Deprecation & Cleanup
- [ ] Disable old payment flows
- [ ] Archive old data
- [ ] Final documentation
- [ ] Celebrate! 🎉

---

## 11. Conclusion

This transition plan provides a comprehensive roadmap for moving from a direct payment system to a credit-based token economy. The key advantages include:

1. **Flexibility**: Users can accumulate and spend credits across services
2. **Platform Revenue**: Commission on withdrawals creates sustainable revenue
3. **Simplified UX**: Single payment flow for clients
4. **Better Control**: Platform mediates all financial transactions
5. **Scalability**: Credit system easier to extend with new features

### Critical Success Factors
- Thorough testing of concurrent transactions
- Secure webhook implementation
- Clear user communication during transition
- Admin tools for withdrawal management
- Comprehensive monitoring and logging

### Recommended Next Action
Start with **Phase 1** (database setup) in a staging environment, then iterate through the implementation checklist systematically.

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-17  
**Author**: AI Assistant (Claude)  
**Status**: Ready for Review
