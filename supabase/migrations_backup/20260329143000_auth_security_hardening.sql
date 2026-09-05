-- Authentication security hardening
-- 1) login_attempts audit table
-- 2) lockout helper (5 failed attempts / 15 minutes)
-- 3) session version rotation helpers to invalidate legacy tokens at authorization boundaries

create table if not exists public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  ip inet,
  success boolean not null,
  failure_reason text,
  created_at timestamptz not null default now()
);

comment on table public.login_attempts is
  'Authentication audit trail of login attempts (success/failure), with user/email/ip and timestamp.';

create index if not exists idx_login_attempts_email_created_at
  on public.login_attempts (email, created_at desc);

create index if not exists idx_login_attempts_user_created_at
  on public.login_attempts (user_id, created_at desc);

create index if not exists idx_login_attempts_ip_created_at
  on public.login_attempts (ip, created_at desc);

alter table public.login_attempts enable row level security;
alter table public.login_attempts force row level security;

-- Deny direct table access from anon/authenticated; writes go through SECURITY DEFINER RPCs.
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

comment on function public.record_login_attempt(text, boolean, uuid, inet, text) is
  'Writes immutable login attempt audit events. Intended for auth flows and edge functions.';

create or replace function public.is_login_locked(p_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select count(*) >= 5
  from public.login_attempts
  where email = lower(trim(p_email))
    and success = false
    and created_at >= now() - interval '15 minutes';
$$;

comment on function public.is_login_locked(text) is
  'Returns true when an email has >=5 failed login attempts within the last 15 minutes.';

grant execute on function public.record_login_attempt(text, boolean, uuid, inet, text) to anon, authenticated, service_role;
grant execute on function public.is_login_locked(text) to anon, authenticated, service_role;

create table if not exists public.user_session_versions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version integer not null default 1,
  rotated_at timestamptz not null default now(),
  rotated_reason text
);

comment on table public.user_session_versions is
  'Monotonic session version for users. Increment to invalidate older tokens at authorization checks.';

alter table public.user_session_versions enable row level security;
alter table public.user_session_versions force row level security;

revoke all on table public.user_session_versions from anon;
revoke all on table public.user_session_versions from authenticated;

create or replace function public.rotate_user_session_version(
  p_user_id uuid,
  p_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_version integer;
begin
  insert into public.user_session_versions (user_id, version, rotated_at, rotated_reason)
  values (p_user_id, 2, now(), p_reason)
  on conflict (user_id)
  do update
    set version = public.user_session_versions.version + 1,
        rotated_at = now(),
        rotated_reason = p_reason
  returning version into v_new_version;

  -- Mirror session version into auth app metadata so fresh JWT claims can carry the new value.
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('session_version', v_new_version)
  where id = p_user_id;

  return v_new_version;
end;
$$;

comment on function public.rotate_user_session_version(uuid, text) is
  'Increments user session version and updates auth app metadata (session_version claim source).';

grant execute on function public.rotate_user_session_version(uuid, text) to authenticated, service_role;
