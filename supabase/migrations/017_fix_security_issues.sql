-- ============================================
-- Security fixes from QA review (2026-03-16)
-- C4: trade_insights open RLS policy
-- C5: handle_new_user role injection
-- C6: mt5_investor_password column exposure
-- ============================================

-- ── C4: Fix trade_insights wide-open RLS policy ──
-- The "Service can manage trade insights" policy used USING(true) WITH CHECK(true)
-- which allows ANY authenticated user to read/write ANY row.
-- Service role already bypasses RLS, so this policy is unnecessary and dangerous.
-- Wrapped in DO block because trade_insights table may not exist yet (migration 014).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'trade_insights'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Service can manage trade insights" ON public.trade_insights';

    -- Only create if policy doesn't already exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'trade_insights'
        AND policyname = 'Users can read own trade insights'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can read own trade insights"
        ON public.trade_insights FOR SELECT
        USING (is_own_account(client_account_id))';
    END IF;
  END IF;
END;
$$;


-- ── C5: Fix handle_new_user() role injection from metadata ──
-- Previously: role was read from raw_user_meta_data->>'role', allowing
-- any user to self-assign 'admin' or 'master_ib' during signup.
-- Fix: Always default to 'client'. Admin promotes users manually.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), NEW.email),
    'client',  -- ALWAYS default to client; admin promotes manually
    NEW.raw_user_meta_data->>'picture'
  );

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;


-- ── C6: Revoke direct access to mt5_investor_password column ──
-- App code uses CLIENT_ACCOUNT_PUBLIC_COLUMNS which excludes this column,
-- but direct Supabase client queries from browser devtools could read it.

REVOKE SELECT (mt5_investor_password) ON public.client_accounts FROM authenticated;
REVOKE SELECT (mt5_investor_password) ON public.client_accounts FROM anon;
