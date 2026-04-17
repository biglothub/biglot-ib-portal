-- Phase 3A: Dead-letter queue for persistent sync failures.
-- When an account hits the consecutive-fail threshold, we log it here and notify the IB.
-- Admin UI can later surface open failures to triage.

CREATE TABLE IF NOT EXISTS sync_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  error_message text NOT NULL,
  error_code text,        -- 'mt5_login', 'mt5_fetch', 'supabase_upsert', 'unknown'
  consecutive_failures integer NOT NULL DEFAULT 1,
  failed_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  ib_notified boolean NOT NULL DEFAULT false,
  admin_notified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_failures_account_open
  ON sync_failures (client_account_id, failed_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sync_failures_unresolved
  ON sync_failures (failed_at DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE sync_failures ENABLE ROW LEVEL SECURITY;

-- Admins see all; IBs see only failures for their accounts.
CREATE POLICY sync_failures_admin_read ON sync_failures
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY sync_failures_ib_read ON sync_failures
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_accounts ca
      JOIN master_ibs mi ON mi.id = ca.master_ib_id
      WHERE ca.id = sync_failures.client_account_id
        AND mi.user_id = auth.uid()
    )
  );

COMMENT ON TABLE sync_failures IS
  'Dead-letter log for accounts whose sync has failed repeatedly. Bridge inserts on threshold breach; admin/IB UI triages; resolved_at set when sync recovers.';
