-- Phase 1A: Smart Scheduler
-- Tier-based sync scheduling so the bridge only polls accounts that are due,
-- instead of every approved account on every cycle.

ALTER TABLE client_accounts
  ADD COLUMN IF NOT EXISTS next_sync_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS sync_tier text NOT NULL DEFAULT 'normal'
    CHECK (sync_tier IN ('live', 'active', 'normal', 'idle', 'closed'));

-- Bridge selects accounts where next_sync_at <= now(); index speeds that up.
CREATE INDEX IF NOT EXISTS idx_client_accounts_next_sync
  ON client_accounts (next_sync_at)
  WHERE status = 'approved';

COMMENT ON COLUMN client_accounts.next_sync_at IS
  'Earliest time the bridge should pick this account up again. Set by sync worker after each successful sync based on activity tier.';

COMMENT ON COLUMN client_accounts.sync_tier IS
  'Most recent activity tier — live (open positions), active (recent trades), normal, idle, closed (market closed). Drives next_sync_at interval.';
