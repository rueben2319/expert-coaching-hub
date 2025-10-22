-- Remove client payment features completely
-- This migration removes coach_packages table and all related functionality
-- Client subscriptions and one-time payments are not implemented

-- Drop coach_packages table (not used in payment flow)
DROP TABLE IF EXISTS public.coach_packages CASCADE;

-- Note: The following tables were already removed in migration 20251017160510:
-- - client_subscriptions
-- - client_orders  
-- - subscription_audit_log

-- Update: All courses are now free for clients to enroll
-- Only coach platform subscriptions remain active
