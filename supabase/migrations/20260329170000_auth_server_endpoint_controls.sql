-- Server-side auth endpoint security controls
-- 1) Per-email and per-IP lockout helper (5 failures / 15 min)
-- 2) Password hash policy helpers (bcrypt cost >= 12)
-- 3) Automatic session invalidation on password change/reset

-- Ensure auth audit and session-version tables exist even if previous hardening migration
-- was not applied in the target environment.
create table if not exists public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  ip inet,
  success boolean not null,
  failure_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_login_attempts_email_created_at
  on public.login_attempts (email, created_at desc);

create index if not exists idx_login_attempts_user_created_at
  on public.login_attempts (user_id, created_at desc);

create index if not exists idx_login_attempts_ip_created_at
  on public.login_attempts (ip, created_at desc);

alter table public.login_attempts enable row level security;
alter table public.login_attempts force row level security;
revoke all on table public.login_attempts from anon;
revoke all on table public.login_attempts from authenticated;

create or replace function public.record_login_attempt(
  p_email text,
  p_success boolean,
  p_user_id uuid default null,
  p_ip inet default null,
  p_failure_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.login_attempts (email, success, user_id, ip, failure_reason)
  values (lower(trim(p_email)), p_success, p_user_id, p_ip, p_failure_reason);
end;
$$;

grant execute on function public.record_login_attempt(text, boolean, uuid, inet, text) to anon, authenticated, service_role;

create table if not exists public.user_session_versions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version integer not null default 1,
  rotated_at timestamptz not null default now(),
  rotated_reason text
);

alter table public.user_session_versions enable row level security;
alter table public.user_session_versions force row level security;
revoke all on table public.user_session_versions from anon;
revoke all on table public.user_session_versions from authenticated;

create or replace function public.is_login_locked(
  p_email text,
  p_ip inet
)
returns boolean
language sql
security definer
set search_path = public
as $$
  with failed as (
    select
      count(*) filter (
        where email = lower(trim(p_email))
          and success = false
          and created_at >= now() - interval '15 minutes'
      ) as email_failures,
      count(*) filter (
        where p_ip is not null
          and ip = p_ip
          and success = false
          and created_at >= now() - interval '15 minutes'
      ) as ip_failures
    from public.login_attempts
  )
  select (email_failures >= 5) or (ip_failures >= 5)
  from failed;
$$;

comment on function public.is_login_locked(text, inet) is
  'Returns true when email OR IP has >=5 failed login attempts within 15 minutes.';

grant execute on function public.is_login_locked(text, inet) to anon, authenticated, service_role;

create or replace function public.get_auth_user_security_by_email(p_email text)
returns table (
  user_id uuid,
  email text,
  email_verified boolean,
  bcrypt_cost integer
)
language sql
security definer
set search_path = public, auth
as $$
  select
    u.id as user_id,
    u.email,
    (u.email_confirmed_at is not null) as email_verified,
    case
      when u.encrypted_password ~ '^\\$2[aby]\\$[0-9]{2}\\$' then substring(u.encrypted_password from '^\\$2[aby]\\$([0-9]{2})\\$')::int
      else null
    end as bcrypt_cost
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

comment on function public.get_auth_user_security_by_email(text) is
  'Returns auth security posture for a given email, including verification and bcrypt cost.';

grant execute on function public.get_auth_user_security_by_email(text) to service_role;

create or replace function public.handle_auth_password_change_session_invalidation()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_new_version integer;
begin
  if tg_op = 'UPDATE' and coalesce(new.encrypted_password, '') is distinct from coalesce(old.encrypted_password, '') then
    insert into public.user_session_versions (user_id, version, rotated_at, rotated_reason)
    values (new.id, 2, now(), 'password_changed_or_reset')
    on conflict (user_id)
    do update
      set version = public.user_session_versions.version + 1,
          rotated_at = now(),
          rotated_reason = 'password_changed_or_reset'
    returning version into v_new_version;

    update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('session_version', v_new_version)
    where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_auth_password_change_session_invalidation on auth.users;

create trigger trg_auth_password_change_session_invalidation
after update of encrypted_password on auth.users
for each row
execute function public.handle_auth_password_change_session_invalidation();
