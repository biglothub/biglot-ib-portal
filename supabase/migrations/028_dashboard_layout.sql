-- Dashboard layout: per-user widget show/hide + ordering
create table if not exists dashboard_layouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  layout jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table dashboard_layouts enable row level security;

create policy "Users manage own dashboard layout"
  on dashboard_layouts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
