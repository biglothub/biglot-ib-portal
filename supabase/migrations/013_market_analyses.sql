-- ============================================
-- AI Market Analyses (daily gold analysis cache)
-- ============================================

CREATE TABLE IF NOT EXISTS public.market_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  symbol text NOT NULL DEFAULT 'XAUUSD',
  analysis_date date NOT NULL DEFAULT CURRENT_DATE,
  sections jsonb NOT NULL DEFAULT '{}',
  model text NOT NULL DEFAULT 'gpt-4o',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, client_account_id, symbol, analysis_date)
);

-- RLS
ALTER TABLE public.market_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_analyses" ON public.market_analyses;

CREATE POLICY "users_own_analyses"
  ON public.market_analyses FOR ALL
  USING (user_id = auth.uid());

-- Index
CREATE INDEX IF NOT EXISTS idx_market_analyses_lookup
  ON public.market_analyses(user_id, symbol, analysis_date DESC);

-- Cleanup older than 30 days
CREATE OR REPLACE FUNCTION public.cleanup_old_analyses()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM market_analyses WHERE created_at < now() - interval '30 days';
$$;
