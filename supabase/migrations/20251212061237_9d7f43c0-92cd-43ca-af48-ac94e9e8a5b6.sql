
-- Remove duplicate RLS update policy on profiles table
-- "Users can update own profile" and "Users can update their own profile" are identical
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
