-- ============================================
-- Notebook System — Flexible note-taking with folders
-- ============================================

-- 1. NOTEBOOK FOLDERS
CREATE TABLE public.notebook_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('system', 'custom')),
  system_type text, -- 'all', 'trade_notes', 'daily_journal', 'sessions'
  icon text DEFAULT '📁',
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notebook_folders_user ON public.notebook_folders(user_id);

-- 2. NOTEBOOK NOTES
CREATE TABLE public.notebook_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.notebook_folders(id) ON DELETE SET NULL,
  title text DEFAULT '',
  content text DEFAULT '',
  content_plain text DEFAULT '', -- plain text extracted for search
  linked_trade_id uuid REFERENCES public.trades(id) ON DELETE SET NULL,
  linked_date date,
  linked_session text CHECK (linked_session IN ('asian', 'london', 'newyork')),
  is_pinned boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notebook_notes_user ON public.notebook_notes(user_id, is_deleted);
CREATE INDEX idx_notebook_notes_folder ON public.notebook_notes(folder_id);
CREATE INDEX idx_notebook_notes_trade ON public.notebook_notes(linked_trade_id);
CREATE INDEX idx_notebook_notes_date ON public.notebook_notes(linked_date);
CREATE INDEX idx_notebook_notes_search ON public.notebook_notes
  USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content_plain, '')));

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE public.notebook_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebook_notes ENABLE ROW LEVEL SECURITY;

-- Folders
CREATE POLICY "Users can view own folders"
  ON public.notebook_folders FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own folders"
  ON public.notebook_folders FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own folders"
  ON public.notebook_folders FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own folders"
  ON public.notebook_folders FOR DELETE USING (user_id = auth.uid());

-- Notes
CREATE POLICY "Users can view own notes"
  ON public.notebook_notes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own notes"
  ON public.notebook_notes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own notes"
  ON public.notebook_notes FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own notes"
  ON public.notebook_notes FOR DELETE USING (user_id = auth.uid());
