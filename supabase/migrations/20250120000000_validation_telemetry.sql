-- ===========================================
-- VALIDATION TELEMETRY
-- ===========================================
-- Logs all frequency validation decisions for admin review
-- Helps identify hallucination patterns and improve RAG/prompts
-- ===========================================

-- Create validation logs table
CREATE TABLE IF NOT EXISTS public.frequency_validation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Context
    diagnostic_upload_id UUID REFERENCES public.diagnostic_uploads(id) ON DELETE SET NULL,
    analysis_id UUID REFERENCES public.diagnostic_analyses(id) ON DELETE SET NULL,

    -- What AI attempted to output
    attempted_frequency TEXT NOT NULL,

    -- Validation result
    validation_result TEXT NOT NULL CHECK (validation_result IN (
        'exact_match',      -- Matched approved name exactly
        'alias_match',      -- Matched via alias
        'fuzzy_match',      -- Matched with typo correction (Levenshtein ≤ 2)
        'rejected_hz',      -- CRITICAL: Rejected because it contained Hz values
        'rejected_unknown'  -- Rejected: not in approved list
    )),

    -- If matched, what it matched to
    matched_to TEXT,                    -- The canonical approved name it matched to
    fuzzy_distance INTEGER,             -- Levenshtein distance if fuzzy match

    -- Context for debugging and improvement
    ai_rationale TEXT,                  -- What AI said about why it chose this
    rag_context_snippet TEXT,           -- What RAG content led to this suggestion

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_validation_logs_result
    ON public.frequency_validation_logs(validation_result);
CREATE INDEX IF NOT EXISTS idx_validation_logs_attempted
    ON public.frequency_validation_logs(attempted_frequency);
CREATE INDEX IF NOT EXISTS idx_validation_logs_created
    ON public.frequency_validation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_validation_logs_upload
    ON public.frequency_validation_logs(diagnostic_upload_id);

-- RLS: Only admins can view validation logs
ALTER TABLE public.frequency_validation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read validation logs" ON public.frequency_validation_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Admins can insert logs (via server-side API)
CREATE POLICY "Service role can insert logs" ON public.frequency_validation_logs
    FOR INSERT WITH CHECK (true);

-- ===========================================
-- VALIDATION STATS VIEW (for admin dashboard)
-- ===========================================

CREATE OR REPLACE VIEW public.validation_stats AS
SELECT
    validation_result,
    COUNT(*) as count,
    DATE_TRUNC('day', created_at) as day
FROM public.frequency_validation_logs
GROUP BY validation_result, DATE_TRUNC('day', created_at)
ORDER BY day DESC, count DESC;

-- Top rejected frequencies (candidates for adding to approved list)
CREATE OR REPLACE VIEW public.top_rejected_frequencies AS
SELECT
    attempted_frequency,
    COUNT(*) as rejection_count,
    MAX(ai_rationale) as sample_rationale,
    MAX(rag_context_snippet) as sample_context
FROM public.frequency_validation_logs
WHERE validation_result IN ('rejected_hz', 'rejected_unknown')
GROUP BY attempted_frequency
ORDER BY rejection_count DESC
LIMIT 50;

-- ===========================================
-- SUCCESS
-- ===========================================
DO $$
BEGIN
    RAISE NOTICE 'Migration complete: Validation telemetry table created for admin review';
END $$;
