-- User trade settings: default PT/SL, timezone, commission overrides per symbol
create table if not exists public.user_trade_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  timezone text not null default 'Asia/Bangkok',
  default_tp_pips numeric,
  default_sl_pips numeric,
  symbol_settings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- Enable RLS
alter table public.user_trade_settings enable row level security;

-- Users can only read/write their own settings
create policy "Users can read own trade settings"
  on public.user_trade_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert own trade settings"
  on public.user_trade_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own trade settings"
  on public.user_trade_settings for update
  using (auth.uid() = user_id);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_trade_settings_updated_at
  before update on public.user_trade_settings
  for each row execute function public.set_updated_at();
