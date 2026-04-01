-- Drop duplicate RLS policies on credit_wallets
DROP POLICY IF EXISTS "Users can view their own credit balance" ON public.credit_wallets;
DROP POLICY IF EXISTS "Users can update their own credit balance" ON public.credit_wallets;

-- Drop duplicate RLS policies on client_notes
DROP POLICY IF EXISTS "client_notes_select_owner" ON public.client_notes;
DROP POLICY IF EXISTS "client_notes_insert_owner" ON public.client_notes;
DROP POLICY IF EXISTS "client_notes_update_owner" ON public.client_notes;
DROP POLICY IF EXISTS "client_notes_delete_owner" ON public.client_notes;

-- Drop duplicate RLS policies on profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_trigger_insert" ON public.profiles;