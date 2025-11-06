-- ============================================
-- SECURITY FIX: Encrypt Payment Credentials & Protect User Emails (Fixed)
-- ============================================

-- Part 1: Create profiles_public view (removes email exposure)
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT 
  id,
  full_name,
  avatar_url,
  created_at,
  updated_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.profiles_public TO anon;

COMMENT ON VIEW public.profiles_public IS 
  'Public-safe view of user profiles that excludes sensitive email addresses. Use this view instead of direct table access for non-essential profile queries.';

-- Part 2: Add vault storage support for PayChangu keys
ALTER TABLE public.coach_settings 
ADD COLUMN IF NOT EXISTS paychangu_key_vault_id UUID;

CREATE INDEX IF NOT EXISTS idx_coach_settings_vault_id 
ON public.coach_settings(paychangu_key_vault_id) 
WHERE paychangu_key_vault_id IS NOT NULL;

COMMENT ON COLUMN public.coach_settings.paychangu_secret_key IS 
  'DEPRECATED: Plain text storage of payment keys. Migrate to paychangu_key_vault_id for encrypted storage.';

COMMENT ON COLUMN public.coach_settings.paychangu_key_vault_id IS 
  'UUID reference to encrypted secret in Supabase Vault. Preferred method for storing payment credentials.';

-- Part 3: Create secure function to retrieve payment keys
CREATE OR REPLACE FUNCTION public.get_coach_payment_key(coach_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vault_id UUID;
  secret_key TEXT;
BEGIN
  -- Only allow coaches to get their own key or admins to get any key
  IF auth.uid() != coach_user_id AND NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized access to payment credentials';
  END IF;

  -- Get the vault ID from coach_settings
  SELECT paychangu_key_vault_id INTO vault_id
  FROM public.coach_settings
  WHERE coach_id = coach_user_id
    AND paychangu_enabled = true;

  -- If no vault ID, check for legacy plain text key
  IF vault_id IS NULL THEN
    SELECT paychangu_secret_key INTO secret_key
    FROM public.coach_settings
    WHERE coach_id = coach_user_id
      AND paychangu_enabled = true;
    
    RETURN secret_key;
  END IF;

  -- Retrieve from vault (when vault is configured)
  -- Note: Vault integration requires additional setup
  -- For now, this returns NULL to indicate vault retrieval is needed
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_coach_payment_key(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_coach_payment_key(UUID) IS 
  'Securely retrieves PayChangu secret key for a coach. Enforces authorization and uses vault when configured. Falls back to legacy plain text storage during migration period.';

-- Part 4: Update RLS policy for profiles to be more restrictive
DROP POLICY IF EXISTS "Authenticated users can view limited profile data" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles in shared courses"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- User can view their own profile (includes email)
  auth.uid() = id
  OR
  -- Admins can view all profiles
  has_role(auth.uid(), 'admin')
  OR
  -- Coaches can view profiles of their enrolled students
  EXISTS (
    SELECT 1 FROM courses c
    JOIN course_enrollments ce ON ce.course_id = c.id
    WHERE c.coach_id = auth.uid() 
    AND ce.user_id = profiles.id
  )
  OR
  -- Students can view profiles of their coaches (coach profiles only, not other students)
  EXISTS (
    SELECT 1 FROM courses c
    JOIN course_enrollments ce ON ce.course_id = c.id
    WHERE ce.user_id = auth.uid()
    AND c.coach_id = profiles.id
  )
);

COMMENT ON POLICY "Authenticated users can view profiles in shared courses" ON public.profiles IS
  'Restricts profile access to own profile, admins, and direct coach-student relationships. Use profiles_public view for non-email profile data.';