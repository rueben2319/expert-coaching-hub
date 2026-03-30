-- Auth System Rebuild: ACID-compliant trigger

-- 1. Replace handle_new_user with truly atomic version
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role public.app_role;
  raw_role text;
BEGIN
  raw_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'client');

  IF raw_role = 'coach' THEN
    user_role := 'coach'::public.app_role;
  ELSE
    user_role := 'client'::public.app_role;
  END IF;

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role);

  INSERT INTO public.credit_wallets (user_id, balance, total_earned, total_spent)
  VALUES (NEW.id, 0, 0, 0);

  RETURN NEW;
END;
$$;

-- 2. Drop upsert_own_role
DROP FUNCTION IF EXISTS public.upsert_own_role(public.app_role);

-- 3. Lock down user_roles RLS
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'user_roles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', pol.policyname);
  END LOOP;
END;
$$;

CREATE POLICY "users_read_own_role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "admins_read_all_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "service_role_manage_roles" ON public.user_roles
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;