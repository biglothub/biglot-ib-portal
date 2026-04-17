-- Migration: Webhook Configurations
-- Allow users to configure LINE Notify / Discord webhook URLs for trade events

create table if not exists webhook_configs (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) on delete cascade not null,
  webhook_type text        not null check (webhook_type in ('line', 'discord')),
  webhook_url  text        not null,
  events       text[]      not null default array['trade_sync', 'daily_pnl', 'rule_break'],
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, webhook_type)
);

alter table webhook_configs enable row level security;

create policy "Users manage own webhooks" on webhook_configs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
