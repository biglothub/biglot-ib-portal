-- Migration 026: Email Report Settings
-- Stores per-user preferences for automated daily/weekly email reports

CREATE TABLE IF NOT EXISTS email_report_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Daily end-of-day summary
  daily_enabled   boolean NOT NULL DEFAULT false,
  -- Hour (0-23, UTC) to send daily report. Default 20:00 UTC
  daily_send_hour smallint NOT NULL DEFAULT 20 CHECK (daily_send_hour >= 0 AND daily_send_hour <= 23),

  -- Weekly digest (sent on Sunday)
  weekly_enabled  boolean NOT NULL DEFAULT false,
  -- Day of week (0=Sun, 6=Sat) for weekly digest
  weekly_day      smallint NOT NULL DEFAULT 0 CHECK (weekly_day >= 0 AND weekly_day <= 6),

  -- Rate-limiting: track last sends
  last_daily_sent_at  timestamptz,
  last_weekly_sent_at timestamptz,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id)
);

-- RLS
ALTER TABLE email_report_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own email settings"
  ON email_report_settings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_email_report_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_email_report_settings_updated_at
  BEFORE UPDATE ON email_report_settings
  FOR EACH ROW EXECUTE FUNCTION update_email_report_settings_updated_at();

-- Index for batch sending (scan by hour/day)
CREATE INDEX idx_email_report_settings_daily
  ON email_report_settings (daily_send_hour)
  WHERE daily_enabled = true;

CREATE INDEX idx_email_report_settings_weekly
  ON email_report_settings (weekly_day)
  WHERE weekly_enabled = true;
