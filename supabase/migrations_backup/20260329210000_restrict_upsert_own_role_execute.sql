-- Restrict direct access to self-role upsert RPC.
-- Role onboarding now flows through controlled edge functions with explicit authz + audit logs.
REVOKE EXECUTE ON FUNCTION public.upsert_own_role(app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_own_role(app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_own_role(app_role) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_own_role(app_role) TO service_role;
