create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.ai_chats (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  client_account_id uuid not null references public.client_accounts(id) on delete cascade,
  surface_role text not null check (surface_role in ('admin', 'master_ib', 'client')),
  surface_context text,
  title text,
  last_message_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_chats_scope
  on public.ai_chats (owner_user_id, client_account_id, archived_at, last_message_at desc, created_at desc);

create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.ai_chats(id) on delete cascade,
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  actor_role text not null check (actor_role in ('admin', 'master_ib', 'client')),
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  client_account_id uuid not null references public.client_accounts(id) on delete cascade,
  mode text not null check (mode in ('portfolio', 'coach', 'gold', 'general')),
  route_type text not null check (route_type in ('direct_answer', 'tool_augmented_answer', 'gold_analysis', 'coach_summary')),
  provider text,
  model text,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  latency_ms integer,
  tool_call_count integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_runs_scope
  on public.ai_runs (target_user_id, client_account_id, created_at desc);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.ai_chats(id) on delete cascade,
  run_id uuid references public.ai_runs(id) on delete set null,
  role text not null check (role in ('user', 'assistant')),
  mode text not null check (mode in ('portfolio', 'coach', 'gold', 'general')),
  content text not null,
  citations jsonb,
  token_usage jsonb,
  status text not null default 'completed' check (status in ('completed', 'failed', 'streaming')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_messages_chat
  on public.ai_messages (chat_id, created_at asc);

create table if not exists public.ai_tool_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ai_runs(id) on delete cascade,
  tool_name text not null,
  tool_args jsonb,
  result_summary text,
  data_sources text[] not null default '{}',
  row_count integer,
  cached boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_tool_calls_run
  on public.ai_tool_calls (run_id, created_at asc);

create table if not exists public.ai_memory (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  client_account_id uuid not null references public.client_accounts(id) on delete cascade,
  memory_type text not null check (memory_type in ('portfolio', 'preference', 'note', 'coach')),
  key text not null,
  value jsonb not null default '{}'::jsonb,
  confidence numeric not null default 0.5,
  source_run_id uuid references public.ai_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, client_account_id, memory_type, key)
);

create index if not exists idx_ai_memory_scope
  on public.ai_memory (owner_user_id, client_account_id, memory_type, updated_at desc);

create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.ai_messages(id) on delete cascade,
  run_id uuid references public.ai_runs(id) on delete set null,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  feedback text not null check (feedback in ('positive', 'negative')),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_feedback_owner
  on public.ai_feedback (owner_user_id, created_at desc);

drop trigger if exists ai_chats_updated_at on public.ai_chats;
create trigger ai_chats_updated_at
  before update on public.ai_chats
  for each row execute function public.set_updated_at();

drop trigger if exists ai_runs_updated_at on public.ai_runs;
create trigger ai_runs_updated_at
  before update on public.ai_runs
  for each row execute function public.set_updated_at();

drop trigger if exists ai_messages_updated_at on public.ai_messages;
create trigger ai_messages_updated_at
  before update on public.ai_messages
  for each row execute function public.set_updated_at();

drop trigger if exists ai_tool_calls_updated_at on public.ai_tool_calls;
create trigger ai_tool_calls_updated_at
  before update on public.ai_tool_calls
  for each row execute function public.set_updated_at();

drop trigger if exists ai_memory_updated_at on public.ai_memory;
create trigger ai_memory_updated_at
  before update on public.ai_memory
  for each row execute function public.set_updated_at();

drop trigger if exists ai_feedback_updated_at on public.ai_feedback;
create trigger ai_feedback_updated_at
  before update on public.ai_feedback
  for each row execute function public.set_updated_at();

alter table public.ai_chats enable row level security;
alter table public.ai_runs enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_tool_calls enable row level security;
alter table public.ai_memory enable row level security;
alter table public.ai_feedback enable row level security;

drop policy if exists "ai_chats_read_own" on public.ai_chats;
create policy "ai_chats_read_own"
  on public.ai_chats for select
  using (owner_user_id = auth.uid() and is_own_account(client_account_id));

drop policy if exists "ai_runs_read_own" on public.ai_runs;
create policy "ai_runs_read_own"
  on public.ai_runs for select
  using (target_user_id = auth.uid() and is_own_account(client_account_id));

drop policy if exists "ai_messages_read_own" on public.ai_messages;
create policy "ai_messages_read_own"
  on public.ai_messages for select
  using (
    chat_id in (
      select id from public.ai_chats
      where owner_user_id = auth.uid()
        and is_own_account(client_account_id)
    )
  );

drop policy if exists "ai_tool_calls_read_own" on public.ai_tool_calls;
create policy "ai_tool_calls_read_own"
  on public.ai_tool_calls for select
  using (
    run_id in (
      select id from public.ai_runs
      where target_user_id = auth.uid()
        and is_own_account(client_account_id)
    )
  );

drop policy if exists "ai_memory_read_own" on public.ai_memory;
create policy "ai_memory_read_own"
  on public.ai_memory for select
  using (owner_user_id = auth.uid() and is_own_account(client_account_id));

drop policy if exists "ai_feedback_read_own" on public.ai_feedback;
create policy "ai_feedback_read_own"
  on public.ai_feedback for select
  using (owner_user_id = auth.uid());

drop policy if exists "ai_feedback_insert_own" on public.ai_feedback;
create policy "ai_feedback_insert_own"
  on public.ai_feedback for insert
  with check (owner_user_id = auth.uid());
