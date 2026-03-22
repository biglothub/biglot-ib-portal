-- Migration 027: Coaches Schedule
-- Stores coach information for the Live Trade schedule page
-- Replaces hardcoded coach list in live-trade/+page.svelte

CREATE TABLE IF NOT EXISTS coaches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Display info
  name            text NOT NULL,                -- e.g. 'COACH PING'
  channel_name    text NOT NULL,                -- e.g. 'Gold with Ping'
  youtube_handle  text NOT NULL,                -- e.g. '@goldwithping'
  avatar_url      text,                         -- e.g. '/coaches/ping.png'

  -- Schedule (Bangkok time, 24h format)
  start_hour      smallint NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
  end_hour        smallint NOT NULL CHECK (end_hour >= 0 AND end_hour <= 26),  -- >24 for overnight
  time_display    text NOT NULL,                -- e.g. '05:00-07:00'

  -- Styling (Tailwind classes)
  color_gradient  text NOT NULL DEFAULT 'from-blue-500 to-indigo-400',
  color_border    text NOT NULL DEFAULT 'border-blue-500/30',
  color_text      text NOT NULL DEFAULT 'text-blue-400',
  color_bg        text NOT NULL DEFAULT 'bg-blue-500/10',
  glow_rgb        text NOT NULL DEFAULT '59,130,246',  -- RGB for glow animation

  -- State
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      smallint NOT NULL DEFAULT 0,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;

-- Everyone can read coaches (public schedule)
CREATE POLICY "coaches_select_all" ON coaches
  FOR SELECT USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "coaches_admin_insert" ON coaches
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "coaches_admin_update" ON coaches
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "coaches_admin_delete" ON coaches
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Seed default coaches (current hardcoded data)
INSERT INTO coaches (name, channel_name, youtube_handle, avatar_url, start_hour, end_hour, time_display, color_gradient, color_border, color_text, color_bg, glow_rgb, sort_order) VALUES
  ('COACH PING',   'Gold with Ping',            '@goldwithping',            '/coaches/ping.png',   5,  7,  '05:00-07:00', 'from-pink-500 to-rose-400',    'border-pink-500/30',   'text-pink-400',   'bg-pink-500/10',   '236,72,153',  1),
  ('COACH BALL',   'Trader10X',                  '@trader10-x',             '/coaches/ball.png',   7,  10, '07:00-10:00', 'from-orange-500 to-amber-400', 'border-orange-500/30', 'text-orange-400', 'bg-orange-500/10', '249,115,22',  2),
  ('COACH PU',     'Pu MoneyMind',               '@PuMoneyMind',            '/coaches/pu.png',     10, 12, '10:00-12:00', 'from-yellow-500 to-amber-300', 'border-yellow-500/30', 'text-yellow-400', 'bg-yellow-500/10', '234,179,8',   3),
  ('COACH CZECH',  'ALL Time High',              '@alltimehigh.official',   '/coaches/czech.png',  12, 14, '12:00-14:00', 'from-green-500 to-emerald-400','border-green-500/30',  'text-green-400',  'bg-green-500/10',  '34,197,94',   4),
  ('COACH FUTURE', 'Trade the Future',           '@tradethefuturebyfuture', '/coaches/future.png', 14, 16, '14:00-16:00', 'from-teal-500 to-cyan-400',    'border-teal-500/30',   'text-teal-400',   'bg-teal-500/10',   '20,184,166',  5),
  ('COACH JHEE',   'Jhee Aroonwan',              '@jheearoonwan',           '/coaches/jhee.png',   16, 19, '16:00-19:00', 'from-blue-500 to-indigo-400',  'border-blue-500/30',   'text-blue-400',   'bg-blue-500/10',   '59,130,246',  6),
  ('COACH ICZ',    'เทรดทองกับท่านสุดต๋าล',       '@portgoldtrader',         '/coaches/icz.png',    19, 21, '19:00-21:00', 'from-purple-500 to-violet-400','border-purple-500/30', 'text-purple-400', 'bg-purple-500/10', '168,85,247',  7),
  ('COACH DUK',    'PIDFAH',                     '@Pidfah',                 '/coaches/duk.png',    21, 23, '21:00-23:00', 'from-pink-500 to-fuchsia-400', 'border-pink-500/30',   'text-pink-400',   'bg-pink-500/10',   '217,70,239',  8),
  ('COACH MAY',    'Mayday Channel',             '@MC.Maydaychannel',       '/coaches/may.png',    23, 26, '23:00-02:00', 'from-red-500 to-rose-400',     'border-red-500/30',    'text-red-400',    'bg-red-500/10',    '239,68,68',   9);
