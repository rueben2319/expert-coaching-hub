-- Secure database-backed OAuth token storage (service-role access only)
create extension if not exists pgcrypto;

create table if not exists public.oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  access_token_encrypted text,
  refresh_token_encrypted text,
  expires_at timestamptz,
  scope text,
  refresh_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists idx_oauth_tokens_user_provider
  on public.oauth_tokens(user_id, provider);

create index if not exists idx_oauth_tokens_expires_at
  on public.oauth_tokens(expires_at);

alter table public.oauth_tokens enable row level security;
alter table public.oauth_tokens force row level security;

-- Explicitly deny access for anon/authenticated roles.
revoke all on table public.oauth_tokens from anon;
revoke all on table public.oauth_tokens from authenticated;

-- Optional hard-deny RLS policies for non-service roles.
drop policy if exists "deny_anon_oauth_tokens" on public.oauth_tokens;
create policy "deny_anon_oauth_tokens"
on public.oauth_tokens
for all
to anon
using (false)
with check (false);

drop policy if exists "deny_authenticated_oauth_tokens" on public.oauth_tokens;
create policy "deny_authenticated_oauth_tokens"
on public.oauth_tokens
for all
to authenticated
using (false)
with check (false);
