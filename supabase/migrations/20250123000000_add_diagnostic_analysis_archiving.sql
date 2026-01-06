-- Migration: Add archiving and analysis-level supplementation to diagnostic_analyses
-- Created: 2025-01-23

-- ===========================================
-- 1. Add is_archived column for soft delete
-- ===========================================
ALTER TABLE diagnostic_analyses
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Add archived_at timestamp for tracking when analysis was archived
ALTER TABLE diagnostic_analyses
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Add index for efficient filtering of non-archived analyses
CREATE INDEX IF NOT EXISTS idx_diagnostic_analyses_archived
ON diagnostic_analyses(practitioner_id, is_archived, created_at DESC);

-- ===========================================
-- 2. Add supplementation at analysis level
-- ===========================================
-- Supplementation was previously stored at protocol_recommendations level (duplicated per protocol)
-- Moving to analysis level for cleaner data model
-- Format: [{name, dosage, timing, rationale}]

ALTER TABLE diagnostic_analyses
ADD COLUMN IF NOT EXISTS supplementation JSONB DEFAULT '[]';

COMMENT ON COLUMN diagnostic_analyses.supplementation IS 'Supplementation recommendations at analysis level. Format: [{name: string, dosage: string, timing: string, rationale: string}]';

COMMENT ON COLUMN diagnostic_analyses.is_archived IS 'Soft delete flag. True when protocols have been logged and analysis should be hidden from active view';

COMMENT ON COLUMN diagnostic_analyses.archived_at IS 'Timestamp when analysis was archived (protocols logged)';
