-- ============================================
-- Daily Checklist & Discipline Tracking System
-- ============================================

-- 1. CHECKLIST RULES (user-defined manual + automated rules)
CREATE TABLE public.checklist_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('manual', 'automated')),
  automated_check text, -- 'trades_have_sl', 'journal_complete', 'max_loss_trade', 'max_loss_day', 'trades_linked_playbook'
  condition jsonb DEFAULT '{}', -- {"threshold": 100, "unit": "percent"} or {"max": 100, "unit": "usd"}
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_checklist_rules_account ON public.checklist_rules(client_account_id);
CREATE INDEX idx_checklist_rules_user ON public.checklist_rules(user_id);

-- 2. CHECKLIST COMPLETIONS (daily check/uncheck per rule)
CREATE TABLE public.checklist_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.checklist_rules(id) ON DELETE CASCADE,
  date date NOT NULL,
  completed boolean DEFAULT false,
  auto_value numeric, -- actual value for automated rules (e.g. 85 for 85%)
  completed_at timestamptz,
  UNIQUE(rule_id, date)
);

CREATE INDEX idx_checklist_completions_date ON public.checklist_completions(client_account_id, date);
CREATE INDEX idx_checklist_completions_user ON public.checklist_completions(user_id, date);

-- 3. DAILY STARTS ("Start my day" tracking)
CREATE TABLE public.daily_starts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_account_id, date)
);

CREATE INDEX idx_daily_starts_date ON public.daily_starts(client_account_id, date);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE public.checklist_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_starts ENABLE ROW LEVEL SECURITY;

-- Checklist Rules
CREATE POLICY "Users can view own checklist rules"
  ON public.checklist_rules FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own checklist rules"
  ON public.checklist_rules FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own checklist rules"
  ON public.checklist_rules FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own checklist rules"
  ON public.checklist_rules FOR DELETE
  USING (user_id = auth.uid());

-- Checklist Completions
CREATE POLICY "Users can view own completions"
  ON public.checklist_completions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own completions"
  ON public.checklist_completions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own completions"
  ON public.checklist_completions FOR UPDATE
  USING (user_id = auth.uid());

-- Daily Starts
CREATE POLICY "Users can view own daily starts"
  ON public.daily_starts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own daily starts"
  ON public.daily_starts FOR INSERT
  WITH CHECK (user_id = auth.uid());
