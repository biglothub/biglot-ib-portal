-- Phase 3B: Per-account health metrics.
-- Complements bridge_health (global singleton) with per-account visibility so Admin UI
-- can spot which specific accounts are slow or failing.

ALTER TABLE client_accounts
  ADD COLUMN IF NOT EXISTS last_sync_duration_ms integer,
  ADD COLUMN IF NOT EXISTS avg_sync_duration_ms integer;

COMMENT ON COLUMN client_accounts.last_sync_duration_ms IS
  'Wall-clock duration of the most recent successful sync in milliseconds.';

COMMENT ON COLUMN client_accounts.avg_sync_duration_ms IS
  'Exponential moving average of sync duration in ms (alpha=0.2). Useful for Admin dashboards.';
