-- Migration 024: Supabase Storage bucket for trade screenshots
-- Creates a private bucket for annotated trade chart screenshots

-- Create storage bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trade-screenshots',
  'trade-screenshots',
  false,
  10485760, -- 10 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: users can upload to their own folder (user_id/trade_id/filename)
CREATE POLICY "Users can upload their own trade screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trade-screenshots' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: users can read their own screenshots
CREATE POLICY "Users can read their own trade screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'trade-screenshots' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: users can delete their own screenshots
CREATE POLICY "Users can delete their own trade screenshots"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'trade-screenshots' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Add 'screenshot' to the valid attachment kinds check (trade_attachments table)
-- The existing constraint only allows 'link' | 'image_url'
-- We need to expand it to also allow 'screenshot'
ALTER TABLE trade_attachments
  DROP CONSTRAINT IF EXISTS trade_attachments_kind_check;

ALTER TABLE trade_attachments
  ADD CONSTRAINT trade_attachments_kind_check
  CHECK (kind IN ('link', 'image_url', 'screenshot'));
