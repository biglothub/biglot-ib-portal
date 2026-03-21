-- Bridge health monitoring table
-- Singleton row updated by bridge service each sync cycle

CREATE TABLE IF NOT EXISTS bridge_health (
    id text PRIMARY KEY DEFAULT 'singleton',
    last_heartbeat timestamptz,
    status text DEFAULT 'running',
    accounts_synced integer DEFAULT 0,
    accounts_failed integer DEFAULT 0,
    cycle_duration_ms integer,
    total_cycles integer DEFAULT 0,
    error_message text,
    version text,
    updated_at timestamptz DEFAULT now()
);

-- Insert default row
INSERT INTO bridge_health (id) VALUES ('singleton') ON CONFLICT DO NOTHING;

-- RLS: only admin can read bridge health
ALTER TABLE bridge_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_bridge_health" ON bridge_health
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
