-- Create RPC to allow an authenticated user to upsert their own role safely
-- The function runs as SECURITY DEFINER and bypasses RLS correctly while restricting
-- changes to only the caller's own row.

CREATE OR REPLACE FUNCTION public.upsert_own_role(p_role public.app_role)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_existing public.user_roles%ROWTYPE;
  v_result jsonb;
BEGIN
  -- Identify the caller
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: no auth.uid()';
  END IF;

  -- Validate input
  IF p_role IS NULL THEN
    RAISE EXCEPTION 'Role must not be null';
  END IF;

  -- Upsert the caller's role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, p_role)
  ON CONFLICT (user_id)
  DO UPDATE SET role = EXCLUDED.role
  RETURNING * INTO v_existing;

  -- Also mirror to auth metadata (best-effort; ignore failures)
  PERFORM
    auth.set_claim(
      v_user_id,
      'user_metadata',
      jsonb_set(
        COALESCE((select raw_user_meta_data from auth.users where id = v_user_id), '{}'::jsonb),
        '{role}',
        to_jsonb(p_role::text),
        true
      )
    )
  ;

  v_result := jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'role', v_existing.role
  );
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.upsert_own_role(public.app_role) TO authenticated;


