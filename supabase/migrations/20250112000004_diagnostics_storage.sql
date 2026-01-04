-- Create diagnostics storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'diagnostics',
  'diagnostics',
  false,  -- Private bucket - only authenticated users
  52428800,  -- 50MB in bytes (larger files for scans)
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  -- .docx
    'application/msword'  -- .doc
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload diagnostics to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'diagnostics' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage policy: Allow authenticated users to read their own diagnostics
CREATE POLICY "Users can read their own diagnostics"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'diagnostics' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage policy: Allow authenticated users to update their own diagnostics
CREATE POLICY "Users can update their own diagnostics"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'diagnostics' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage policy: Allow authenticated users to delete their own diagnostics
CREATE POLICY "Users can delete their own diagnostics"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'diagnostics' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DO $$ BEGIN RAISE NOTICE 'Migration complete: diagnostics storage bucket created'; END $$;
