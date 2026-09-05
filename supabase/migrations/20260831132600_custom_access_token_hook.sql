-- Custom Access Token Hook
-- Embeds the user's application role into every JWT at issuance time.
-- This eliminates the need for any client-side DB role lookup.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  claims jsonb;
  user_role text;
begin
  -- Read role from user_roles table
  select role into user_role
  from public.user_roles
  where user_id = (event->>'user_id')::uuid;

  claims := event->'claims';

  -- Ensure app_metadata key exists
  if jsonb_typeof(claims->'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  end if;

  -- Inject role (null-safe: skip injection if no role found)
  if user_role is not null then
    claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(user_role));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- Required permission grants
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;

-- Revoke from everyone else for security
revoke execute on function public.custom_access_token_hook
  from authenticated, anon, public;
