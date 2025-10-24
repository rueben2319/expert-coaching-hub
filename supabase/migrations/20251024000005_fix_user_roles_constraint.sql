-- Migration: Fix user roles constraint to allow only one role per user
-- Description: Drops the composite unique constraint and adds a unique constraint on user_id only
-- Date: 2024-10-24

-- First, remove the existing constraint that allows multiple roles per user
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;

-- Add a unique constraint on user_id only to ensure one role per user
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

-- Update the handle_new_user function to properly handle role updates
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role public.app_role;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Get role from user metadata, default to 'client' if not specified
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client')::public.app_role;
  
  -- Assign role using INSERT with ON CONFLICT UPDATE
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role)
  ON CONFLICT (user_id) DO UPDATE SET role = user_role;
  
  -- Initialize credit wallet with 0 balance
  INSERT INTO public.credit_wallets (user_id, balance)
  VALUES (NEW.id, 0.00)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 'Creates profile, assigns role from metadata (or default client), and initializes credit wallet for new users';
