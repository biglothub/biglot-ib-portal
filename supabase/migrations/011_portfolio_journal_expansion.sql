-- ============================================
-- Portfolio Journal Expansion
-- ============================================

-- 1. Extend tag categories
ALTER TABLE public.trade_tags
  DROP CONSTRAINT IF EXISTS trade_tags_category_check;

ALTER TABLE public.trade_tags
  ADD CONSTRAINT trade_tags_category_check
  CHECK (category IN ('setup', 'execution', 'emotion', 'mistake', 'market_condition', 'custom'));

-- 2. Extend daily journal
ALTER TABLE public.daily_journal
  ADD COLUMN IF NOT EXISTS session_plan text DEFAULT '',
  ADD COLUMN IF NOT EXISTS market_bias text DEFAULT '',
  ADD COLUMN IF NOT EXISTS key_levels text DEFAULT '',
  ADD COLUMN IF NOT EXISTS checklist jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS energy_score integer CHECK (energy_score >= 1 AND energy_score <= 5),
  ADD COLUMN IF NOT EXISTS discipline_score integer CHECK (discipline_score >= 1 AND discipline_score <= 5),
  ADD COLUMN IF NOT EXISTS confidence_score integer CHECK (confidence_score >= 1 AND confidence_score <= 5),
  ADD COLUMN IF NOT EXISTS lessons text DEFAULT '',
  ADD COLUMN IF NOT EXISTS tomorrow_focus text DEFAULT '',
  ADD COLUMN IF NOT EXISTS completion_status text NOT NULL DEFAULT 'not_started';

ALTER TABLE public.daily_journal
  DROP CONSTRAINT IF EXISTS daily_journal_completion_status_check;

ALTER TABLE public.daily_journal
  ADD CONSTRAINT daily_journal_completion_status_check
  CHECK (completion_status IN ('not_started', 'in_progress', 'complete'));

-- 3. Playbooks
CREATE TABLE IF NOT EXISTS public.playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  setup_tag_id uuid REFERENCES public.trade_tags(id) ON DELETE SET NULL,
  entry_criteria jsonb DEFAULT '[]'::jsonb,
  exit_criteria jsonb DEFAULT '[]'::jsonb,
  risk_rules jsonb DEFAULT '[]'::jsonb,
  mistakes_to_avoid jsonb DEFAULT '[]'::jsonb,
  example_trade_ids uuid[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_playbooks_user_account
  ON public.playbooks(user_id, client_account_id, is_active, sort_order);

-- 4. Trade reviews
CREATE TABLE IF NOT EXISTS public.trade_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL UNIQUE REFERENCES public.trades(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  playbook_id uuid REFERENCES public.playbooks(id) ON DELETE SET NULL,
  review_status text NOT NULL DEFAULT 'unreviewed',
  entry_reason text DEFAULT '',
  exit_reason text DEFAULT '',
  execution_notes text DEFAULT '',
  risk_notes text DEFAULT '',
  mistake_summary text DEFAULT '',
  lesson_summary text DEFAULT '',
  next_action text DEFAULT '',
  setup_quality_score integer CHECK (setup_quality_score >= 1 AND setup_quality_score <= 5),
  discipline_score integer CHECK (discipline_score >= 1 AND discipline_score <= 5),
  execution_score integer CHECK (execution_score >= 1 AND execution_score <= 5),
  confidence_at_entry integer CHECK (confidence_at_entry >= 1 AND confidence_at_entry <= 5),
  followed_plan boolean,
  broken_rules text[] DEFAULT '{}',
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.trade_reviews
  DROP CONSTRAINT IF EXISTS trade_reviews_review_status_check;

ALTER TABLE public.trade_reviews
  ADD CONSTRAINT trade_reviews_review_status_check
  CHECK (review_status IN ('unreviewed', 'in_progress', 'reviewed'));

CREATE INDEX IF NOT EXISTS idx_trade_reviews_user_status
  ON public.trade_reviews(user_id, review_status, reviewed_at DESC);

-- 5. Trade attachments
CREATE TABLE IF NOT EXISTS public.trade_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'link',
  storage_path text NOT NULL,
  caption text DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.trade_attachments
  DROP CONSTRAINT IF EXISTS trade_attachments_kind_check;

ALTER TABLE public.trade_attachments
  ADD CONSTRAINT trade_attachments_kind_check
  CHECK (kind IN ('link', 'image_url'));

CREATE INDEX IF NOT EXISTS idx_trade_attachments_trade
  ON public.trade_attachments(trade_id, sort_order, created_at);

-- 6. Saved views
CREATE TABLE IF NOT EXISTS public.portfolio_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  page text NOT NULL,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, client_account_id, page, name)
);

ALTER TABLE public.portfolio_saved_views
  DROP CONSTRAINT IF EXISTS portfolio_saved_views_page_check;

ALTER TABLE public.portfolio_saved_views
  ADD CONSTRAINT portfolio_saved_views_page_check
  CHECK (page IN ('trades', 'analytics'));

CREATE INDEX IF NOT EXISTS idx_portfolio_saved_views_user
  ON public.portfolio_saved_views(user_id, client_account_id, page);

-- 7. Progress goals
CREATE TABLE IF NOT EXISTS public.progress_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  goal_type text NOT NULL,
  target_value numeric NOT NULL DEFAULT 0,
  period_days integer NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, client_account_id, goal_type)
);

ALTER TABLE public.progress_goals
  DROP CONSTRAINT IF EXISTS progress_goals_goal_type_check;

ALTER TABLE public.progress_goals
  ADD CONSTRAINT progress_goals_goal_type_check
  CHECK (goal_type IN ('review_completion', 'journal_streak', 'max_rule_breaks', 'profit_factor', 'win_rate'));

CREATE INDEX IF NOT EXISTS idx_progress_goals_user
  ON public.progress_goals(user_id, client_account_id, is_active);

-- 8. Trade chart context
CREATE TABLE IF NOT EXISTS public.trade_chart_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  timeframe text NOT NULL DEFAULT 'M5',
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  bars jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(trade_id, timeframe)
);

CREATE INDEX IF NOT EXISTS idx_trade_chart_context_trade
  ON public.trade_chart_context(trade_id, timeframe);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "playbooks_admin_all" ON public.playbooks;
DROP POLICY IF EXISTS "playbooks_own_all" ON public.playbooks;
CREATE POLICY "playbooks_admin_all" ON public.playbooks FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "playbooks_own_all" ON public.playbooks FOR ALL USING (user_id = auth.uid());

ALTER TABLE public.trade_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trade_reviews_admin_all" ON public.trade_reviews;
DROP POLICY IF EXISTS "trade_reviews_own_all" ON public.trade_reviews;
CREATE POLICY "trade_reviews_admin_all" ON public.trade_reviews FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "trade_reviews_own_all" ON public.trade_reviews FOR ALL USING (user_id = auth.uid());

ALTER TABLE public.trade_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trade_attachments_admin_all" ON public.trade_attachments;
DROP POLICY IF EXISTS "trade_attachments_own_select" ON public.trade_attachments;
DROP POLICY IF EXISTS "trade_attachments_own_modify" ON public.trade_attachments;
CREATE POLICY "trade_attachments_admin_all" ON public.trade_attachments FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "trade_attachments_own_select" ON public.trade_attachments FOR SELECT USING (is_own_trade(trade_id));
CREATE POLICY "trade_attachments_own_modify" ON public.trade_attachments FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.portfolio_saved_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "portfolio_saved_views_admin_all" ON public.portfolio_saved_views;
DROP POLICY IF EXISTS "portfolio_saved_views_own_all" ON public.portfolio_saved_views;
CREATE POLICY "portfolio_saved_views_admin_all" ON public.portfolio_saved_views FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "portfolio_saved_views_own_all" ON public.portfolio_saved_views FOR ALL USING (user_id = auth.uid());

ALTER TABLE public.progress_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "progress_goals_admin_all" ON public.progress_goals;
DROP POLICY IF EXISTS "progress_goals_own_all" ON public.progress_goals;
CREATE POLICY "progress_goals_admin_all" ON public.progress_goals FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "progress_goals_own_all" ON public.progress_goals FOR ALL USING (user_id = auth.uid());

ALTER TABLE public.trade_chart_context ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trade_chart_context_admin_all" ON public.trade_chart_context;
DROP POLICY IF EXISTS "trade_chart_context_own_select" ON public.trade_chart_context;
CREATE POLICY "trade_chart_context_admin_all" ON public.trade_chart_context FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "trade_chart_context_own_select" ON public.trade_chart_context FOR SELECT USING (is_own_trade(trade_id));
