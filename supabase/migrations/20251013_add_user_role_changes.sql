-- Create user role changes audit table
CREATE TABLE IF NOT EXISTS public.user_role_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allow admins to view the role change history
ALTER TABLE public.user_role_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and self can view role changes"
  ON public.user_role_changes FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert role changes"
  ON public.user_role_changes FOR INSERT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete role changes"
  ON public.user_role_changes FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));
