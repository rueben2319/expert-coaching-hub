-- Migration: Remove client subscription and one-time payment tables
-- This migration removes all client payment functionality while keeping coach subscriptions

-- First, remove foreign key constraints that reference these tables
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_client_subscription_id_fkey;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_order_id_fkey;

-- Remove columns from transactions table that reference client payments
ALTER TABLE transactions DROP COLUMN IF EXISTS client_subscription_id;
ALTER TABLE transactions DROP COLUMN IF EXISTS order_id;

-- Drop the client payment tables
DROP TABLE IF EXISTS client_subscriptions CASCADE;
DROP TABLE IF EXISTS client_orders CASCADE;
DROP TABLE IF EXISTS coach_packages CASCADE;

-- Remove RLS policies for dropped tables
DROP POLICY IF EXISTS "Users can view their own client subscriptions" ON client_subscriptions;
DROP POLICY IF EXISTS "Users can view their own client orders" ON client_orders;
DROP POLICY IF EXISTS "Coaches can manage their own packages" ON coach_packages;
DROP POLICY IF EXISTS "Everyone can view active coach packages" ON coach_packages;

-- Add comment to track the removal
COMMENT ON TABLE transactions IS 'Updated: Removed client_subscription_id and order_id columns - client payments now handled via credit system';
