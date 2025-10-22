-- 20251017160510_remove_client_payment_tables.sql
-- Remove client payment functionality safely
-- Drop dependencies first, then clean up orphan data

-- ============================================
-- STEP 1: Drop foreign key constraints
-- ============================================

-- Drop constraints that reference client_subscriptions
ALTER TABLE IF EXISTS public.transactions
    DROP CONSTRAINT IF EXISTS transactions_client_subscription_id_fkey;

ALTER TABLE IF EXISTS public.invoices
    DROP CONSTRAINT IF EXISTS invoices_client_subscription_id_fkey;

-- ============================================
-- STEP 2: Drop RLS policies that reference client_subscriptions
-- ============================================

-- Drop the specific policy mentioned in the error
DROP POLICY IF EXISTS "Users can view audit logs for their subscriptions" ON public.subscription_audit_log;

-- ============================================
-- STEP 3: Drop dependent tables/views/logs if any
-- ============================================
DROP TABLE IF EXISTS public.subscription_audit_log CASCADE;
DROP VIEW IF EXISTS public.subscription_audit_log CASCADE;

-- ============================================
-- STEP 4: Drop tables in reverse dependency order
-- ============================================

-- Drop client_subscriptions table (references coach_packages)
DROP TABLE IF EXISTS public.client_subscriptions CASCADE;

-- Drop client_orders table (referenced by transactions and invoices)
DROP TABLE IF EXISTS public.client_orders CASCADE;

-- ============================================
-- STEP 5: Clean up transactions & invoices
-- ============================================

-- Remove client_subscription_id column from transactions table
ALTER TABLE public.transactions DROP COLUMN IF EXISTS client_subscription_id;

-- Clean up orphaned transactions
DELETE FROM public.transactions
WHERE order_id IS NOT NULL
   OR subscription_id IN (
     SELECT id FROM public.coach_subscriptions
     WHERE tier_id IS NULL
   );

-- Clean up orphaned invoices
DELETE FROM public.invoices
WHERE order_id IS NOT NULL
   OR subscription_id IN (
     SELECT id FROM public.coach_subscriptions
     WHERE tier_id IS NULL
   );

-- ============================================
-- STEP 6: Final note
-- ============================================
-- Coach-related data (coach_subscriptions, tiers, coach_packages)
-- remains intact for platform and coach billing features.