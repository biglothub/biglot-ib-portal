-- ============================================
-- Google OAuth for Clients - Email Lookup Index
-- ============================================

-- Index for fast email matching during OAuth callback
CREATE INDEX IF NOT EXISTS idx_client_accounts_email
  ON public.client_accounts(client_email)
  WHERE client_email IS NOT NULL AND status = 'approved';
