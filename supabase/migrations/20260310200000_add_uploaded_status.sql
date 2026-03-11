-- Add 'uploaded' status to diagnostic_uploads
-- This represents the state where all files are uploaded but analysis hasn't started yet
ALTER TABLE public.diagnostic_uploads
    DROP CONSTRAINT IF EXISTS diagnostic_uploads_status_check;

ALTER TABLE public.diagnostic_uploads
    ADD CONSTRAINT diagnostic_uploads_status_check
    CHECK (status IN ('pending', 'uploading', 'uploaded', 'processing', 'complete', 'error'));
