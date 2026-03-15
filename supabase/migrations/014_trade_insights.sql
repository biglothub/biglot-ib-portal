-- ============================================
-- Trade Insights — Auto-detected trade patterns
-- ============================================

CREATE TABLE public.trade_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  rule_id text NOT NULL,
  category text NOT NULL CHECK (category IN ('positive', 'negative', 'warning', 'info')),
  message text NOT NULL,
  data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(trade_id, rule_id)
);

CREATE INDEX idx_trade_insights_trade ON public.trade_insights(trade_id);
CREATE INDEX idx_trade_insights_account ON public.trade_insights(client_account_id);
CREATE INDEX idx_trade_insights_category ON public.trade_insights(client_account_id, category);

-- RLS
ALTER TABLE public.trade_insights ENABLE ROW LEVEL SECURITY;

-- Users can view insights for their own accounts
CREATE POLICY "Users can view own trade insights"
  ON public.trade_insights FOR SELECT
  USING (
    client_account_id IN (
      SELECT id FROM public.client_accounts WHERE user_id = auth.uid()
    )
  );

-- Service role (bridge/server) can insert/update/delete
CREATE POLICY "Service can manage trade insights"
  ON public.trade_insights FOR ALL
  USING (true)
  WITH CHECK (true);
