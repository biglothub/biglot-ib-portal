-- Social Trading Feed: opt-in sharing, likes, comments, leaderboard

-- ─── Social settings per user (opt-in) ────────────────────────────────────────
create table if not exists public.social_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  bio text not null default '',
  is_public boolean not null default false,
  -- Which MT5 account to use for leaderboard stats (optional)
  client_account_id uuid references public.client_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.social_settings enable row level security;

-- Own settings always readable/writable
create policy "social_settings_read_own"
  on public.social_settings for select using (auth.uid() = user_id);

-- Any authenticated user can read public settings (for leaderboard/feed attribution)
create policy "social_settings_read_public"
  on public.social_settings for select using (is_public = true);

create policy "social_settings_insert_own"
  on public.social_settings for insert with check (auth.uid() = user_id);

create policy "social_settings_update_own"
  on public.social_settings for update using (auth.uid() = user_id);

-- ─── Social posts ──────────────────────────────────────────────────────────────
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Denormalized at creation time so posts survive profile renames
  display_name text not null,
  avatar_url text,
  post_type text not null check (post_type in ('trade_share', 'insight', 'milestone')),
  content text not null check (char_length(content) >= 1 and char_length(content) <= 500),
  -- Optional linked trade snapshot
  trade_id uuid references public.trades(id) on delete set null,
  trade_symbol text,
  trade_side text,
  trade_profit numeric,
  -- Counters kept in sync via triggers
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.social_posts enable row level security;

-- All authenticated users can read all posts
create policy "social_posts_read_all"
  on public.social_posts for select using (auth.uid() is not null);

create policy "social_posts_insert_own"
  on public.social_posts for insert with check (auth.uid() = user_id);

create policy "social_posts_delete_own"
  on public.social_posts for delete using (auth.uid() = user_id);

-- ─── Social likes (toggle, unique per user+post) ──────────────────────────────
create table if not exists public.social_likes (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.social_likes enable row level security;

create policy "social_likes_read_all"
  on public.social_likes for select using (auth.uid() is not null);

create policy "social_likes_insert_own"
  on public.social_likes for insert with check (auth.uid() = user_id);

create policy "social_likes_delete_own"
  on public.social_likes for delete using (auth.uid() = user_id);

-- ─── Social comments ──────────────────────────────────────────────────────────
create table if not exists public.social_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Denormalized at creation time
  display_name text not null,
  avatar_url text,
  content text not null check (char_length(content) >= 1 and char_length(content) <= 300),
  created_at timestamptz not null default now()
);

alter table public.social_comments enable row level security;

create policy "social_comments_read_all"
  on public.social_comments for select using (auth.uid() is not null);

create policy "social_comments_insert_own"
  on public.social_comments for insert with check (auth.uid() = user_id);

create policy "social_comments_delete_own"
  on public.social_comments for delete using (auth.uid() = user_id);

-- ─── Trigger: keep likes_count in sync ────────────────────────────────────────
create or replace function public.update_post_likes_count()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    update public.social_posts set likes_count = likes_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update public.social_posts set likes_count = greatest(0, likes_count - 1) where id = OLD.post_id;
  end if;
  return null;
end;
$$;

create trigger social_likes_count_trigger
  after insert or delete on public.social_likes
  for each row execute function public.update_post_likes_count();

-- ─── Trigger: keep comments_count in sync ─────────────────────────────────────
create or replace function public.update_post_comments_count()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    update public.social_posts set comments_count = comments_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update public.social_posts set comments_count = greatest(0, comments_count - 1) where id = OLD.post_id;
  end if;
  return null;
end;
$$;

create trigger social_comments_count_trigger
  after insert or delete on public.social_comments
  for each row execute function public.update_post_comments_count();

-- ─── updated_at trigger for social_settings ───────────────────────────────────
create trigger social_settings_updated_at
  before update on public.social_settings
  for each row execute function public.set_updated_at();

-- ─── Leaderboard function (security definer bypasses trades RLS) ──────────────
create or replace function public.get_social_leaderboard()
returns table(
  user_id uuid,
  display_name text,
  avatar_url text,
  bio text,
  net_pnl numeric,
  win_rate numeric,
  total_trades bigint,
  profit_factor numeric
)
language plpgsql security definer stable
set search_path = public
as $$
begin
  return query
  select
    ss.user_id,
    ss.display_name,
    p.avatar_url,
    ss.bio,
    coalesce(sum(t.profit), 0)::numeric as net_pnl,
    (case
      when count(t.id) > 0
        then (count(case when t.profit > 0 then 1 end)::numeric
              / count(t.id)::numeric * 100)
      else 0
    end)::numeric as win_rate,
    count(t.id) as total_trades,
    (case
      when abs(sum(case when t.profit < 0 then t.profit else 0 end)) > 0
        then sum(case when t.profit > 0 then t.profit else 0 end)
             / abs(sum(case when t.profit < 0 then t.profit else 0 end))
      when sum(case when t.profit > 0 then t.profit else 0 end) > 0
        then 99.99
      else 0
    end)::numeric as profit_factor
  from social_settings ss
  join profiles p on p.id = ss.user_id
  left join client_accounts ca
    on ca.id = ss.client_account_id and ca.status = 'approved'
  left join trades t on t.client_account_id = ca.id
  where ss.is_public = true
    and ss.display_name != ''
  group by ss.user_id, ss.display_name, p.avatar_url, ss.bio;
end;
$$;
