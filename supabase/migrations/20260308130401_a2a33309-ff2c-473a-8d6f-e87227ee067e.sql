
-- 1. Fix upsert_own_role: block admin self-assignment
CREATE OR REPLACE FUNCTION public.upsert_own_role(p_role app_role)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_user_id uuid;
  v_existing public.user_roles%ROWTYPE;
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: no auth.uid()';
  END IF;

  IF p_role IS NULL THEN
    RAISE EXCEPTION 'Role must not be null';
  END IF;

  -- SECURITY: Prevent self-assignment of admin role
  IF p_role = 'admin' THEN
    RAISE EXCEPTION 'Cannot self-assign admin role';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, p_role)
  ON CONFLICT (user_id)
  DO UPDATE SET role = EXCLUDED.role
  RETURNING * INTO v_existing;

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
    );

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
$function$;

-- 2. Fix handle_new_user: restrict role to client/coach only
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  user_role public.app_role;
BEGIN
  RAISE LOG 'handle_new_user triggered for user: %', NEW.id;
  
  BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    )
    ON CONFLICT (id) DO UPDATE 
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = now();
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Profile creation failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;
  
  -- SECURITY: Only allow client or coach roles from metadata, never admin
  BEGIN
    user_role := CASE
      WHEN NEW.raw_user_meta_data->>'role' = 'coach' THEN 'coach'::public.app_role
      ELSE 'client'::public.app_role
    END;
  END;
  
  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, user_role)
    ON CONFLICT (user_id) DO UPDATE 
    SET role = EXCLUDED.role;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Role assignment failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;
  
  BEGIN
    INSERT INTO public.credit_wallets (user_id, balance)
    VALUES (NEW.id, 0.00)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Credit wallet creation failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_user FATAL ERROR for user %: % - %', NEW.id, SQLSTATE, SQLERRM;
    RAISE;
END;
$function$;

-- 3. Fix content_interactions RLS: scope to owner only
DROP POLICY IF EXISTS "content_select_v2" ON public.content_interactions;
DROP POLICY IF EXISTS "content_update_v2" ON public.content_interactions;
DROP POLICY IF EXISTS "content_delete_v2" ON public.content_interactions;
DROP POLICY IF EXISTS "content_insert_v2" ON public.content_interactions;

CREATE POLICY "content_select_owner" ON public.content_interactions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "content_insert_owner" ON public.content_interactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "content_update_owner" ON public.content_interactions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "content_delete_owner" ON public.content_interactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());
