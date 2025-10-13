-- Fix transactions table to support both coach and client subscriptions
-- Add separate column for client subscription IDs
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS client_subscription_id UUID REFERENCES public.client_subscriptions(id) ON DELETE SET NULL;

-- Update the foreign key constraint to only apply to coach subscriptions
-- First drop the existing constraint
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_subscription_id_fkey;

-- Recreate the constraint for coach subscriptions only
ALTER TABLE public.transactions ADD CONSTRAINT transactions_subscription_id_fkey
  FOREIGN KEY (subscription_id) REFERENCES public.coach_subscriptions(id) ON DELETE SET NULL;
