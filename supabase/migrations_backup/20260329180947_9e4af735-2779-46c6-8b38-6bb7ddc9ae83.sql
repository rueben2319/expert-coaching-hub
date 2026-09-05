
-- Fix missing profile, role, and wallet for user dc2753e5-c456-4cf8-9519-592ff3bdfead
-- This user exists in auth.users but the handle_new_user trigger failed

INSERT INTO public.profiles (id, email, full_name)
SELECT 
  u.id, 
  u.email, 
  COALESCE(u.raw_user_meta_data->>'full_name', '')
FROM auth.users u
WHERE u.id = 'dc2753e5-c456-4cf8-9519-592ff3bdfead'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT 
  u.id,
  CASE 
    WHEN u.raw_user_meta_data->>'role' = 'coach' THEN 'coach'::app_role
    ELSE 'client'::app_role
  END
FROM auth.users u
WHERE u.id = 'dc2753e5-c456-4cf8-9519-592ff3bdfead'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.credit_wallets (user_id, balance)
SELECT u.id, 0.00
FROM auth.users u
WHERE u.id = 'dc2753e5-c456-4cf8-9519-592ff3bdfead'
ON CONFLICT (user_id) DO NOTHING;

-- Also fix any OTHER users who might be missing profiles/roles/wallets
-- (safety net for any past trigger failures)
INSERT INTO public.profiles (id, email, full_name)
SELECT 
  u.id, 
  u.email, 
  COALESCE(u.raw_user_meta_data->>'full_name', '')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT 
  u.id,
  CASE 
    WHEN u.raw_user_meta_data->>'role' = 'coach' THEN 'coach'::app_role
    ELSE 'client'::app_role
  END
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.credit_wallets (user_id, balance)
SELECT u.id, 0.00
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.credit_wallets cw WHERE cw.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;
