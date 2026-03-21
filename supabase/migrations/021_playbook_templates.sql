-- ============================================
-- 021: Playbook Templates Marketplace
-- ============================================
-- Allows users to publish playbooks as community templates
-- and clone templates from other users.

-- 1. Playbook Templates table
CREATE TABLE IF NOT EXISTS public.playbook_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT '',
  source_playbook_id uuid REFERENCES public.playbooks(id) ON DELETE SET NULL,

  -- Template content (snapshot from source playbook)
  name text NOT NULL,
  description text DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  entry_criteria jsonb DEFAULT '[]'::jsonb,
  exit_criteria jsonb DEFAULT '[]'::jsonb,
  risk_rules jsonb DEFAULT '[]'::jsonb,
  mistakes_to_avoid jsonb DEFAULT '[]'::jsonb,

  -- Performance stats (snapshot at publish time)
  total_trades integer NOT NULL DEFAULT 0,
  win_rate numeric(5,2) NOT NULL DEFAULT 0,
  avg_rr numeric(6,2) NOT NULL DEFAULT 0,
  net_pnl numeric(12,2) NOT NULL DEFAULT 0,

  -- Social stats
  clone_count integer NOT NULL DEFAULT 0,
  rating_sum integer NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0,

  -- Status
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_playbook_templates_published
  ON public.playbook_templates(is_published, clone_count DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_playbook_templates_author
  ON public.playbook_templates(author_id);

CREATE INDEX IF NOT EXISTS idx_playbook_templates_category
  ON public.playbook_templates(category);

-- 2. Clone tracking table
CREATE TABLE IF NOT EXISTS public.playbook_template_clones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.playbook_templates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  playbook_id uuid REFERENCES public.playbooks(id) ON DELETE SET NULL,
  cloned_at timestamptz DEFAULT now(),
  UNIQUE(template_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_playbook_template_clones_user
  ON public.playbook_template_clones(user_id);

-- 3. RLS Policies
ALTER TABLE public.playbook_templates ENABLE ROW LEVEL SECURITY;

-- Everyone can read published templates
CREATE POLICY "templates_read_published"
  ON public.playbook_templates FOR SELECT
  USING (is_published = true OR author_id = auth.uid());

-- Authors can insert/update/delete their own
CREATE POLICY "templates_author_insert"
  ON public.playbook_templates FOR INSERT
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "templates_author_update"
  ON public.playbook_templates FOR UPDATE
  USING (author_id = auth.uid());

CREATE POLICY "templates_author_delete"
  ON public.playbook_templates FOR DELETE
  USING (author_id = auth.uid());

-- Admin can do everything
CREATE POLICY "templates_admin_all"
  ON public.playbook_templates FOR ALL
  USING (get_user_role() = 'admin');

ALTER TABLE public.playbook_template_clones ENABLE ROW LEVEL SECURITY;

-- Users can read their own clones
CREATE POLICY "clones_own_read"
  ON public.playbook_template_clones FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own clones
CREATE POLICY "clones_own_insert"
  ON public.playbook_template_clones FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Authors can read clones of their templates (for stats)
CREATE POLICY "clones_author_read"
  ON public.playbook_template_clones FOR SELECT
  USING (
    template_id IN (
      SELECT id FROM public.playbook_templates WHERE author_id = auth.uid()
    )
  );

-- Admin can do everything
CREATE POLICY "clones_admin_all"
  ON public.playbook_template_clones FOR ALL
  USING (get_user_role() = 'admin');

-- 4. Updated_at trigger
CREATE OR REPLACE TRIGGER set_playbook_templates_updated_at
  BEFORE UPDATE ON public.playbook_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
