-- =====================================================================
-- ADMIN SELF-ASSIGNMENT PREVENTION
-- Date: 2026-08-28
-- Purpose: Add database-level constraints to prevent admin self-assignment
-- Security: Additional layer of protection beyond application-level checks
-- =====================================================================

-- Create audit table for role changes (if not exists)
CREATE TABLE IF NOT EXISTS public.user_role_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ DEFAULT now(),
  previous_role app_role,
  reason TEXT
);

-- Create index for audit queries
CREATE INDEX IF NOT EXISTS idx_user_role_changes_user_id ON public.user_role_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_changes_changed_by ON public.user_role_changes(changed_by);
CREATE INDEX IF NOT EXISTS idx_user_role_changes_changed_at ON public.user_role_changes(changed_at);

-- Enable RLS on audit table
ALTER TABLE public.user_role_changes ENABLE ROW LEVEL SECURITY;

-- Admins can view all role changes
CREATE POLICY IF NOT EXISTS "Admins can view all role changes" ON public.user_role_changes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

-- System can insert role changes
CREATE POLICY IF NOT EXISTS "System can insert role changes" ON public.user_role_changes
  FOR INSERT WITH CHECK (true);

-- =====================================================================
-- ENHANCED ROLE ASSIGNMENT FUNCTION WITH ADDITIONAL SECURITY
-- =====================================================================

-- Drop existing function if exists
DROP FUNCTION IF EXISTS public.secure_upsert_user_role CASCADE;

CREATE OR REPLACE FUNCTION public.secure_upsert_user_role(
  p_target_user_id UUID,
  p_new_role app_role,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role app_role;
  v_caller_id UUID;
  v_is_self_update BOOLEAN;
  v_previous_role app_role;
  v_result JSONB;
BEGIN
  -- Get caller information
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: no auth.uid()';
  END IF;

  -- Get caller role
  SELECT role INTO v_caller_role
  FROM public.user_roles
  WHERE user_id = v_caller_id;

  -- Check if self-update
  v_is_self_update := (p_target_user_id = v_caller_id);

  -- Security checks
  -- 1. Only admins can change other users' roles
  IF NOT v_is_self_update AND v_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Forbidden: only admins can change another user role';
  END IF;

  -- 2. Non-admins cannot assign admin role (even to themselves)
  IF p_new_role = 'admin' AND v_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Forbidden: only admins can assign admin role';
  END IF;

  -- 3. Non-admins cannot change their role from admin to something else
  IF v_is_self_update AND v_caller_role = 'admin' AND p_new_role != 'admin' THEN
    RAISE EXCEPTION 'Forbidden: admins cannot demote themselves';
  END IF;

  -- Get previous role for audit
  SELECT role INTO v_previous_role
  FROM public.user_roles
  WHERE user_id = p_target_user_id;

  -- Perform the upsert
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_target_user_id, p_new_role)
  ON CONFLICT (user_id) 
  DO UPDATE SET role = EXCLUDED.role;

  -- Update auth metadata
  UPDATE auth.users
  SET 
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', p_new_role::text),
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', p_new_role::text)
  WHERE id = p_target_user_id;

  -- Audit log
  INSERT INTO public.user_role_changes (
    user_id, 
    role, 
    changed_by, 
    previous_role, 
    reason
  ) VALUES (
    p_target_user_id, 
    p_new_role, 
    v_caller_id, 
    v_previous_role, 
    p_reason
  );

  -- Security audit
  INSERT INTO public.security_audit_log (
    event_type,
    user_id,
    target_user_id,
    details
  ) VALUES (
    'role_change',
    v_caller_id,
    p_target_user_id,
    jsonb_build_object(
      'new_role', p_new_role,
      'previous_role', v_previous_role,
      'is_self_update', v_is_self_update,
      'caller_role', v_caller_role,
      'reason', p_reason
    )
  );

  v_result := jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'role', p_new_role,
    'previous_role', v_previous_role,
    'is_self_update', v_is_self_update
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.secure_upsert_user_role(UUID, app_role, TEXT) TO authenticated, service_role;

-- =====================================================================
-- DATABASE CONSTRAINT TO PREVENT ADMIN SELF-ASSIGNMENT
-- =====================================================================

-- Create a trigger function to prevent admin self-assignment at database level
CREATE OR REPLACE FUNCTION public.prevent_admin_self_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_role app_role;
BEGIN
  -- Get current role of the user being updated
  SELECT role INTO v_current_role
  FROM public.user_roles
  WHERE user_id = NEW.user_id;

  -- Prevent changing to admin role if the caller is not an admin
  -- This is a last-resort check; application-level checks should handle this
  IF NEW.role = 'admin' THEN
    -- Only allow if the caller is an admin (checked via auth.uid())
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Security violation: only admins can assign admin role';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger (drop if exists first)
DROP TRIGGER IF EXISTS trg_prevent_admin_self_assignment ON public.user_roles;

CREATE TRIGGER trg_prevent_admin_self_assignment
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_admin_self_assignment();

-- =====================================================================
-- ADD CHECK CONSTRAINT TO PREVENT ROLE ESCALATION
-- =====================================================================

-- Add constraint to ensure only valid roles can be assigned
-- This is already handled by the ENUM type, but we add explicit check for safety
ALTER TABLE public.user_roles 
  DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles 
  ADD CONSTRAINT user_roles_role_check 
  CHECK (role = ANY (ARRAY['client'::app_role, 'coach'::app_role, 'admin'::app_role]));

-- =====================================================================
-- END OF ADMIN SELF-ASSIGNMENT PREVENTION
-- =====================================================================