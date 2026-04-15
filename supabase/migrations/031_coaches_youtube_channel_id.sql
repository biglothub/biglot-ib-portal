-- Migration 031: Add youtube_channel_id to coaches
-- Required for YouTube Data API v3 live stream detection (live-scan endpoint)

ALTER TABLE coaches ADD COLUMN IF NOT EXISTS youtube_channel_id text;

-- Update existing coaches with their YouTube Channel IDs
UPDATE coaches SET youtube_channel_id = 'UChj0MmtkT2dz4h_haF5IJAw' WHERE youtube_handle = '@goldwithping';
UPDATE coaches SET youtube_channel_id = 'UC49_jco-Ew1AHidkQynJFaA' WHERE youtube_handle = '@trader10-x';
UPDATE coaches SET youtube_channel_id = 'UCXoiCrEUCMAnBTCbsKR6iHw' WHERE youtube_handle = '@PuMoneyMind';
UPDATE coaches SET youtube_channel_id = 'UCt90-PH4FWrpIF3HV7FRLgg' WHERE youtube_handle = '@alltimehigh.official';
UPDATE coaches SET youtube_channel_id = 'UC8IMqQFVa9YUE1jVFdqaVow' WHERE youtube_handle = '@tradethefuturebyfuture';
UPDATE coaches SET youtube_channel_id = 'UC0sLLg9rP_vdPvLHVPpnAvA' WHERE youtube_handle = '@jheearoonwan';
UPDATE coaches SET youtube_channel_id = 'UCEk782ecdOhqXbxR5cOYXkw' WHERE youtube_handle = '@portgoldtrader';
UPDATE coaches SET youtube_channel_id = 'UCpXwwQb-BL-pRGcxWJY5FoQ' WHERE youtube_handle = '@Pidfah';
UPDATE coaches SET youtube_channel_id = 'UCJ9dOgwUksRFjCRRMrdVmqw' WHERE youtube_handle = '@MC.Maydaychannel';
