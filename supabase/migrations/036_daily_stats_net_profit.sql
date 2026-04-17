-- Phase 3C: Daily stats includes commission + swap.
-- Historically daily_stats.profit was gross P&L from trades. Brokers charge commission
-- and overnight swap on top, which means displayed daily P&L was rosier than reality.
-- These columns let the UI show true net performance.

ALTER TABLE daily_stats
  ADD COLUMN IF NOT EXISTS commission_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS swap_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_profit numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN daily_stats.commission_total IS
  'Sum of commissions for trades closed this day (negative for costs).';

COMMENT ON COLUMN daily_stats.swap_total IS
  'Sum of overnight swap for trades closed this day.';

COMMENT ON COLUMN daily_stats.net_profit IS
  'profit + commission_total + swap_total — the bottom-line P&L after broker fees.';
