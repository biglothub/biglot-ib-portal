-- Migration: API Keys for Public API
-- Stores hashed API keys for read-only portfolio API access

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  scopes text[] not null default array['trades:read', 'stats:read'],
  last_used_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table api_keys enable row level security;

create policy "Users manage own API keys" on api_keys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_api_keys_key_hash on api_keys (key_hash);
create index idx_api_keys_user_id on api_keys (user_id);
