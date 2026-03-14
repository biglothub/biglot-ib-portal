-- ============================================
-- Daily Market News Cache
-- ============================================

-- 1. News articles table (global, not per-user)
CREATE TABLE IF NOT EXISTS public.market_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  source_url text NOT NULL,
  title_original text NOT NULL,
  title_th text NOT NULL DEFAULT '',
  summary_original text DEFAULT '',
  summary_th text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  symbols text[] DEFAULT '{}',
  relevance_score integer NOT NULL DEFAULT 50 CHECK (relevance_score >= 0 AND relevance_score <= 100),
  published_at timestamptz NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  ai_processed boolean NOT NULL DEFAULT false,
  image_url text,
  UNIQUE(source, source_url)
);

ALTER TABLE public.market_news
  DROP CONSTRAINT IF EXISTS market_news_category_check;

ALTER TABLE public.market_news
  ADD CONSTRAINT market_news_category_check
  CHECK (category IN ('forex', 'commodities', 'central_bank', 'economic_data', 'geopolitical', 'general'));

CREATE INDEX IF NOT EXISTS idx_market_news_published
  ON public.market_news(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_news_category_published
  ON public.market_news(category, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_news_fetched
  ON public.market_news(fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_news_ai_processed
  ON public.market_news(ai_processed) WHERE ai_processed = false;

-- 2. RLS Policies
ALTER TABLE public.market_news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "market_news_authenticated_select" ON public.market_news;
DROP POLICY IF EXISTS "market_news_admin_all" ON public.market_news;

CREATE POLICY "market_news_authenticated_select"
  ON public.market_news FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "market_news_admin_all"
  ON public.market_news FOR ALL
  USING (get_user_role() = 'admin');

-- 3. Cleanup function (delete news older than 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_news()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM market_news WHERE published_at < now() - interval '7 days';
$$;
