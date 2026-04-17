-- Phase 2: Enable Supabase Realtime for live trading data.
-- Frontend subscribes via supabase.channel(...) instead of polling /api/portfolio/sync-trigger.
--
-- Note: realtime broadcasts go through Postgres' logical replication slot, so RLS still
-- protects the row contents — clients only receive events for rows they can SELECT.

DO $$
BEGIN
  -- open_positions: live P&L on currently open trades
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'open_positions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE open_positions;
  END IF;

  -- equity_snapshots: live equity curve / floating P&L
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'equity_snapshots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE equity_snapshots;
  END IF;

  -- trades: notify when a new closed trade lands so dashboards can refresh
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'trades'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE trades;
  END IF;
END $$;

-- Realtime requires REPLICA IDENTITY FULL for DELETE events to include row data.
ALTER TABLE open_positions REPLICA IDENTITY FULL;
ALTER TABLE equity_snapshots REPLICA IDENTITY FULL;
ALTER TABLE trades REPLICA IDENTITY FULL;
