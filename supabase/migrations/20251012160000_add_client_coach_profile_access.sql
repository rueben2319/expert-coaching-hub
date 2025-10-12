-- Add RLS policy to allow clients to view coach profiles
-- This enables the billing page to display coach information

CREATE POLICY "Clients can view coach profiles"
  ON public.profiles FOR SELECT
  USING (
    public.has_role(auth.uid(), 'client') AND
    EXISTS (
      SELECT 1 FROM public.coach_packages
      WHERE coach_packages.coach_id = profiles.id
      AND coach_packages.is_active = true
    )
  );
