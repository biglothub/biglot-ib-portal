-- PWA mobile support: idempotency records for queued writes and notification categories.

CREATE TABLE IF NOT EXISTS public.idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  payload_hash text NOT NULL,
  response_body jsonb NOT NULL DEFAULT '{}'::jsonb,
  status_code integer NOT NULL DEFAULT 200,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_records_user_created
  ON public.idempotency_records(user_id, created_at);

ALTER TABLE public.idempotency_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "idempotency_own" ON public.idempotency_records;
CREATE POLICY "idempotency_own" ON public.idempotency_records
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.user_notification_prefs
  ADD COLUMN IF NOT EXISTS sync_status_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS risk_threshold_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS account_status_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS journal_reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_insight_enabled boolean NOT NULL DEFAULT true;
