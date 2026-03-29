create or replace function public.finalize_oauth_callback(
  p_user_id uuid,
  p_email text,
  p_full_name text default null,
  p_avatar_url text default null
)
returns table (
  role app_role,
  onboarding_state text,
  redirect_to text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role app_role;
  v_role_inserted boolean := false;
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (p_user_id, p_email, nullif(trim(p_full_name), ''), nullif(trim(p_avatar_url), ''))
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();

  insert into public.user_roles (user_id, role)
  values (p_user_id, 'client'::app_role)
  on conflict (user_id) do nothing;

  get diagnostics v_role_inserted = row_count;

  select ur.role into v_role
  from public.user_roles ur
  where ur.user_id = p_user_id;

  if v_role is null then
    role := 'client'::app_role;
    onboarding_state := 'needs_role_selection';
  else
    role := v_role;
    onboarding_state := case when v_role_inserted then 'role_bootstrapped' else 'ready' end;
  end if;

  redirect_to := '/' || role::text;
  return next;
end;
$$;

grant execute on function public.finalize_oauth_callback(uuid, text, text, text) to authenticated;
grant execute on function public.finalize_oauth_callback(uuid, text, text, text) to service_role;
