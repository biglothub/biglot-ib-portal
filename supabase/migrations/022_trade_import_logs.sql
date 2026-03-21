-- Trade Import Logs
-- Tracks CSV import operations for history and auditing

CREATE TABLE IF NOT EXISTS trade_import_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_account_id UUID NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
    filename TEXT NOT NULL DEFAULT 'csv_upload',
    total_rows INTEGER NOT NULL DEFAULT 0,
    imported_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    errors_summary JSONB,
    status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for user history queries
CREATE INDEX IF NOT EXISTS idx_trade_import_logs_user_id ON trade_import_logs(user_id, created_at DESC);

-- RLS
ALTER TABLE trade_import_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own import logs
CREATE POLICY "Users can read own import logs"
    ON trade_import_logs FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own import logs
CREATE POLICY "Users can insert own import logs"
    ON trade_import_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);
