-- ============================================
-- Trading Recaps — AI-powered weekly/monthly summaries
-- ============================================

CREATE TABLE public.trading_recaps (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  period_type text NOT NULL CHECK (period_type IN ('week', 'month')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  stats jsonb NOT NULL DEFAULT '{}',
  sections jsonb NOT NULL DEFAULT '{}',
  model text NOT NULL DEFAULT 'gpt-4o-mini',
  created_at timestamptz DEFAULT now()
);

-- Unique: one recap per user per period
CREATE UNIQUE INDEX idx_trading_recaps_unique
  ON public.trading_recaps (user_id, client_account_id, period_type, period_start);

CREATE INDEX idx_trading_recaps_lookup
  ON public.trading_recaps (client_account_id, user_id, period_start DESC);

ALTER TABLE public.trading_recaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own recaps"
  ON public.trading_recaps FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
