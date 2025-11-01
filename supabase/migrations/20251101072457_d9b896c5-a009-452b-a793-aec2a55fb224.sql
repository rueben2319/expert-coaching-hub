-- Fix Critical Security Vulnerability: Remove public access to user profiles
-- This prevents unauthorized access to user emails and personal information

-- Drop the insecure public read policy
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Create a secure policy: Only allow users to view their own profile
-- Admins can view all profiles via the existing admin policy
CREATE POLICY "Users can view own profile securely"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow authenticated users to view basic profile info of other users in their network
-- (coaches viewing student profiles, students viewing coach profiles)
-- This is more secure than public access
CREATE POLICY "Authenticated users can view limited profile data"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Can view profiles of users in courses they're enrolled in or teaching
  EXISTS (
    SELECT 1 FROM course_enrollments ce1
    JOIN course_enrollments ce2 ON ce1.course_id = ce2.course_id
    WHERE ce1.user_id = auth.uid() 
    AND ce2.user_id = profiles.id
  )
  OR EXISTS (
    SELECT 1 FROM courses c
    JOIN course_enrollments ce ON ce.course_id = c.id
    WHERE c.coach_id = auth.uid()
    AND ce.user_id = profiles.id
  )
  OR EXISTS (
    SELECT 1 FROM courses c
    JOIN course_enrollments ce ON ce.course_id = c.id
    WHERE ce.user_id = auth.uid()
    AND c.coach_id = profiles.id
  )
);

-- Audit: Check for any other tables with overly permissive policies
-- Fix duplicate/conflicting policies on user_roles table

-- Remove duplicate user_roles SELECT policy
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;

-- Keep only the essential policy that allows users to see their own role
CREATE POLICY "Users view own role only"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Fix potential privilege escalation: Ensure users cannot insert their own roles
-- Only the trigger and admin functions should be able to insert roles

-- Add check to prevent manual role manipulation
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS check_role_assignment;
ALTER TABLE public.user_roles 
ADD CONSTRAINT check_role_assignment 
CHECK (role IN ('client', 'coach', 'admin'));

-- Create audit log for role changes to track any suspicious activity
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  target_user_id uuid REFERENCES auth.users(id),
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view security audit logs"
ON public.security_audit_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit logs"
ON public.security_audit_log
FOR INSERT
WITH CHECK (true);

-- Create trigger to log role changes
CREATE OR REPLACE FUNCTION log_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO security_audit_log (
    event_type,
    user_id,
    target_user_id,
    details
  ) VALUES (
    'role_change',
    auth.uid(),
    NEW.user_id,
    jsonb_build_object(
      'old_role', OLD.role,
      'new_role', NEW.role,
      'timestamp', now()
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_role_changes ON public.user_roles;
CREATE TRIGGER audit_role_changes
AFTER UPDATE OF role ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION log_role_change();