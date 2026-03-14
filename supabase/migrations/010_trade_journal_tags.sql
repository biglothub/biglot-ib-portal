-- ============================================
-- Trade Journal, Tags & Notes
-- ============================================

-- 1. TRADE TAGS (reusable tag definitions per user)
CREATE TABLE public.trade_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('setup', 'emotion', 'mistake', 'custom')),
  color text DEFAULT '#3b82f6',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_trade_tags_user ON public.trade_tags(user_id);

-- 2. TRADE-TAG ASSIGNMENTS (many-to-many)
CREATE TABLE public.trade_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.trade_tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(trade_id, tag_id)
);

CREATE INDEX idx_trade_tag_assignments_trade ON public.trade_tag_assignments(trade_id);
CREATE INDEX idx_trade_tag_assignments_tag ON public.trade_tag_assignments(tag_id);

-- 3. TRADE NOTES (one note per trade)
CREATE TABLE public.trade_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  rating integer CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(trade_id)
);

CREATE INDEX idx_trade_notes_trade ON public.trade_notes(trade_id);

-- 4. DAILY JOURNAL (pre/post-market notes per day)
CREATE TABLE public.daily_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  date date NOT NULL,
  pre_market_notes text DEFAULT '',
  post_market_notes text DEFAULT '',
  mood integer CHECK (mood >= 1 AND mood <= 5),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, client_account_id, date)
);

CREATE INDEX idx_daily_journal_user_date ON public.daily_journal(user_id, date DESC);

-- 5. ADD COMMISSION/SWAP TO TRADES
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS commission numeric DEFAULT 0;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS swap numeric DEFAULT 0;

-- ============================================
-- RLS HELPER: Check if trade belongs to user
-- ============================================

CREATE OR REPLACE FUNCTION public.is_own_trade(p_trade_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM trades t
    JOIN client_accounts ca ON ca.id = t.client_account_id
    WHERE t.id = p_trade_id AND ca.user_id = auth.uid()
  );
$$;

-- ============================================
-- RLS POLICIES
-- ============================================

-- TRADE_TAGS
ALTER TABLE public.trade_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tt_admin_all" ON public.trade_tags FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "tt_own_all" ON public.trade_tags FOR ALL USING (user_id = auth.uid());

-- TRADE_TAG_ASSIGNMENTS
ALTER TABLE public.trade_tag_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tta_admin_all" ON public.trade_tag_assignments FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "tta_own_select" ON public.trade_tag_assignments FOR SELECT USING (is_own_trade(trade_id));
CREATE POLICY "tta_own_insert" ON public.trade_tag_assignments FOR INSERT WITH CHECK (is_own_trade(trade_id));
CREATE POLICY "tta_own_delete" ON public.trade_tag_assignments FOR DELETE USING (is_own_trade(trade_id));

-- TRADE_NOTES
ALTER TABLE public.trade_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tn_admin_all" ON public.trade_notes FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "tn_own_all" ON public.trade_notes FOR ALL USING (user_id = auth.uid());

-- DAILY_JOURNAL
ALTER TABLE public.daily_journal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_admin_all" ON public.daily_journal FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "dj_own_all" ON public.daily_journal FOR ALL USING (user_id = auth.uid());
