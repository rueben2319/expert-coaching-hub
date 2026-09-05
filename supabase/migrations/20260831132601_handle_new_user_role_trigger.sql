-- Automatically creates a user_roles row when a new user signs up.
-- The role is taken from user_metadata.role (set during supabase.auth.signUp),
-- defaulting to 'client' if not provided.

create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
begin
  -- Only allow valid roles; default to 'client'
  requested_role := new.raw_user_meta_data->>'role';
  if requested_role not in ('client', 'coach') then
    requested_role := 'client';
  end if;

  insert into public.user_roles (user_id, role)
  values (new.id, requested_role)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Drop trigger if exists (idempotent migration)
drop trigger if exists on_auth_user_created_role on auth.users;

create trigger on_auth_user_created_role
  after insert on auth.users
  for each row execute procedure public.handle_new_user_role();
