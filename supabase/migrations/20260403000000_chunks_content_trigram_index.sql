-- Enable pg_trgm extension for trigram-based ILIKE index support.
-- This allows ILIKE '%term%' queries on document_chunks.content to use
-- a GIN index instead of sequential scans.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create trigram GIN index on document_chunks.content for fast ILIKE searches.
-- Used by _keyword_sunday_fallback() in the RAG presearch pipeline.
-- Note: CONCURRENTLY omitted — Supabase push pipeline does not support it.
--       Non-concurrent index creation is safe here; this runs once at deploy time.
CREATE INDEX IF NOT EXISTS idx_document_chunks_content_trgm
ON document_chunks
USING GIN (content gin_trgm_ops);
