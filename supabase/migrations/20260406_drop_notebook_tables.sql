-- Drop orphaned notebook tables
-- Notebook feature was removed in commit 32582ea (2026-04-06).
-- Content migrated into Journal (daily notes) + Trade Notes.

DROP TABLE IF EXISTS notebook_notes CASCADE;
DROP TABLE IF EXISTS notebook_folders CASCADE;
