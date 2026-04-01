-- Add sync_requested_at column to client_accounts
-- Allows frontend to signal a manual sync request to the bridge service.
-- The bridge reads this on each cycle, prioritizes the account, then clears it after sync.

ALTER TABLE public.client_accounts
  ADD COLUMN IF NOT EXISTS sync_requested_at timestamptz;
