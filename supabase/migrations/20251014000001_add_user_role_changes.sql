-- Create user role changes audit table
CREATE TABLE IF NOT EXISTS public.user_role_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.user_role_changes ENABLE ROW LEVEL SECURITY;

-- Allow admins and users to view role change history (their own or any if admin)
CREATE POLICY "Admins and self can view role changes"
  ON public.user_role_changes
  FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Allow only admins to insert role changes
CREATE POLICY "Admins can insert role changes"
  ON public.user_role_changes
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow only admins to delete role changes
CREATE POLICY "Admins can delete role changes"
  ON public.user_role_changes
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));
