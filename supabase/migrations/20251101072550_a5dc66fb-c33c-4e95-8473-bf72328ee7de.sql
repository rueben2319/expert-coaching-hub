-- Fix security linter warnings
-- 1. Set search_path for security definer functions to prevent SQL injection

-- Fix log_role_change function
CREATE OR REPLACE FUNCTION log_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO security_audit_log (
    event_type,
    user_id,
    target_user_id,
    details
  ) VALUES (
    'role_change',
    auth.uid(),
    NEW.user_id,
    jsonb_build_object(
      'old_role', OLD.role,
      'new_role', NEW.role,
      'timestamp', now()
    )
  );
  RETURN NEW;
END;
$$;

-- Fix cleanup_expired_recommendations function
CREATE OR REPLACE FUNCTION public.cleanup_expired_recommendations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
BEGIN
  DELETE FROM public.recommended_courses
  WHERE expires_at < now();
END;
$function$;