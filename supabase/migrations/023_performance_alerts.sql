-- Performance Alerts: configurable alert rules per user
create table if not exists public.performance_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_type text not null check (alert_type in (
    'daily_loss',
    'daily_profit_target',
    'win_rate_drop',
    'drawdown',
    'loss_streak'
  )),
  threshold numeric not null,
  enabled boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.performance_alerts enable row level security;

create policy "Users can read own alerts"
  on public.performance_alerts for select
  using (auth.uid() = user_id);

create policy "Users can insert own alerts"
  on public.performance_alerts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own alerts"
  on public.performance_alerts for update
  using (auth.uid() = user_id);

create policy "Users can delete own alerts"
  on public.performance_alerts for delete
  using (auth.uid() = user_id);

-- Reuse set_updated_at trigger function (already exists from migration 020)
create trigger performance_alerts_updated_at
  before update on public.performance_alerts
  for each row execute function public.set_updated_at();
