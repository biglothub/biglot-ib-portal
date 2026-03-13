-- ============================================
-- IB Portal - Full Database Schema
-- ============================================

-- 1. PROFILES (extends auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'master_ib', 'client')),
  avatar_url text,
  phone text,
  telegram_chat_id text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_profiles_role ON public.profiles(role);

-- Auto-create profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. MASTER IBs
CREATE TABLE public.master_ibs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ib_code text UNIQUE NOT NULL,
  company_name text,
  commission_rate numeric DEFAULT 0,
  max_clients integer DEFAULT 100,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. CLIENT ACCOUNTS
CREATE TABLE public.client_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  master_ib_id uuid NOT NULL REFERENCES public.master_ibs(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  client_email text,
  client_phone text,
  nickname text,
  mt5_account_id text NOT NULL,
  mt5_investor_password text NOT NULL,
  mt5_server text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id),
  rejection_reason text,
  mt5_validated boolean DEFAULT false,
  mt5_validation_error text,
  last_validated_at timestamptz,
  last_synced_at timestamptz,
  sync_error text,
  sync_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(mt5_account_id, mt5_server)
);

CREATE INDEX idx_client_accounts_master_ib ON public.client_accounts(master_ib_id);
CREATE INDEX idx_client_accounts_status ON public.client_accounts(status);

-- 4. DAILY STATS
CREATE TABLE public.daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  date date NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  equity numeric NOT NULL DEFAULT 0,
  profit numeric NOT NULL DEFAULT 0,
  floating_pl numeric DEFAULT 0,
  margin_level numeric,
  total_lots numeric DEFAULT 0,
  win_rate numeric,
  total_trades integer DEFAULT 0,
  profit_factor numeric,
  rr_ratio numeric,
  max_drawdown numeric,
  peak_equity numeric,
  avg_win numeric,
  avg_loss numeric,
  best_trade numeric,
  worst_trade numeric,
  win_rate_buy numeric,
  win_rate_sell numeric,
  max_consecutive_wins integer,
  max_consecutive_losses integer,
  session_asian_profit numeric,
  session_asian_win_rate numeric,
  session_london_profit numeric,
  session_london_win_rate numeric,
  session_newyork_profit numeric,
  session_newyork_win_rate numeric,
  trading_style text,
  favorite_pair text,
  avg_holding_time text,
  equity_growth_percent numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_account_id, date)
);

CREATE INDEX idx_daily_stats_account_date ON public.daily_stats(client_account_id, date DESC);

-- 5. TRADES
CREATE TABLE public.trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  type text NOT NULL CHECK (type IN ('BUY', 'SELL')),
  lot_size numeric NOT NULL,
  open_price numeric NOT NULL,
  close_price numeric NOT NULL,
  open_time timestamptz NOT NULL,
  close_time timestamptz NOT NULL,
  profit numeric NOT NULL,
  sl numeric,
  tp numeric,
  position_id bigint NOT NULL,
  pips numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_account_id, position_id)
);

CREATE INDEX idx_trades_account_close ON public.trades(client_account_id, close_time DESC);

-- 6. OPEN POSITIONS
CREATE TABLE public.open_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  position_id bigint NOT NULL,
  symbol text NOT NULL,
  type text NOT NULL CHECK (type IN ('BUY', 'SELL')),
  lot_size numeric NOT NULL,
  open_price numeric NOT NULL,
  open_time timestamptz NOT NULL,
  current_price numeric,
  current_profit numeric,
  sl numeric,
  tp numeric,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_account_id, position_id)
);

-- 7. EQUITY SNAPSHOTS
CREATE TABLE public.equity_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL,
  balance numeric NOT NULL,
  equity numeric NOT NULL,
  floating_pl numeric DEFAULT 0,
  margin_level numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_account_id, timestamp)
);

CREATE INDEX idx_equity_snapshots_account_time ON public.equity_snapshots(client_account_id, timestamp DESC);

-- 8. APPROVAL LOG
CREATE TABLE public.approval_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'suspended', 'reactivated', 'resubmitted')),
  performed_by uuid NOT NULL REFERENCES public.profiles(id),
  previous_status text,
  new_status text,
  reason text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_approval_log_account ON public.approval_log(client_account_id, created_at DESC);

-- 9. NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  is_read boolean DEFAULT false,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

-- ============================================
-- RLS HELPER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_master_ib_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM master_ibs WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_own_client(account_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM client_accounts
    WHERE id = account_id AND master_ib_id = (SELECT id FROM master_ibs WHERE user_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_own_account(account_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM client_accounts WHERE id = account_id AND user_id = auth.uid()
  );
$$;

-- ============================================
-- RLS POLICIES
-- ============================================

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_own" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_ib_read_clients" ON public.profiles FOR SELECT USING (
  get_user_role() = 'master_ib' AND id IN (
    SELECT user_id FROM client_accounts WHERE master_ib_id = get_user_master_ib_id() AND user_id IS NOT NULL
  )
);

-- MASTER_IBS
ALTER TABLE public.master_ibs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "master_ibs_admin_all" ON public.master_ibs FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "master_ibs_read_own" ON public.master_ibs FOR SELECT USING (user_id = auth.uid());

-- CLIENT_ACCOUNTS
ALTER TABLE public.client_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ca_admin_all" ON public.client_accounts FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "ca_ib_select" ON public.client_accounts FOR SELECT USING (get_user_role() = 'master_ib' AND master_ib_id = get_user_master_ib_id());
CREATE POLICY "ca_ib_insert" ON public.client_accounts FOR INSERT WITH CHECK (get_user_role() = 'master_ib' AND master_ib_id = get_user_master_ib_id());
CREATE POLICY "ca_ib_update" ON public.client_accounts FOR UPDATE USING (get_user_role() = 'master_ib' AND master_ib_id = get_user_master_ib_id() AND status = 'pending');
CREATE POLICY "ca_client_select" ON public.client_accounts FOR SELECT USING (get_user_role() = 'client' AND user_id = auth.uid());

-- DAILY_STATS
ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ds_admin_all" ON public.daily_stats FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "ds_ib_select" ON public.daily_stats FOR SELECT USING (is_own_client(client_account_id));
CREATE POLICY "ds_client_select" ON public.daily_stats FOR SELECT USING (is_own_account(client_account_id));

-- TRADES
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trades_admin_all" ON public.trades FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "trades_ib_select" ON public.trades FOR SELECT USING (is_own_client(client_account_id));
CREATE POLICY "trades_client_select" ON public.trades FOR SELECT USING (is_own_account(client_account_id));

-- OPEN_POSITIONS
ALTER TABLE public.open_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_admin_all" ON public.open_positions FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "op_ib_select" ON public.open_positions FOR SELECT USING (is_own_client(client_account_id));
CREATE POLICY "op_client_select" ON public.open_positions FOR SELECT USING (is_own_account(client_account_id));

-- EQUITY_SNAPSHOTS
ALTER TABLE public.equity_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "es_admin_all" ON public.equity_snapshots FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "es_ib_select" ON public.equity_snapshots FOR SELECT USING (is_own_client(client_account_id));
CREATE POLICY "es_client_select" ON public.equity_snapshots FOR SELECT USING (is_own_account(client_account_id));

-- APPROVAL_LOG
ALTER TABLE public.approval_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "al_admin_all" ON public.approval_log FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "al_ib_select" ON public.approval_log FOR SELECT USING (is_own_client(client_account_id));

-- NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_own" ON public.notifications FOR ALL USING (user_id = auth.uid());
