-- ===========================================
-- RECOMMENDATION APPROVAL WORKFLOW
-- ===========================================
-- Adds approval status to protocol_recommendations
-- Allows practitioners to approve before executing
-- ===========================================

-- Add approved status to protocol_recommendations
ALTER TABLE public.protocol_recommendations
    DROP CONSTRAINT IF EXISTS protocol_recommendations_status_check;

ALTER TABLE public.protocol_recommendations
    ADD CONSTRAINT protocol_recommendations_status_check
    CHECK (status IN ('recommended', 'approved', 'executed', 'declined'));

-- Add approval metadata columns
ALTER TABLE public.protocol_recommendations
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id);

-- Index for finding approved recommendations
CREATE INDEX IF NOT EXISTS idx_protocol_recommendations_status
    ON public.protocol_recommendations(status);

CREATE INDEX IF NOT EXISTS idx_protocol_recommendations_approved_at
    ON public.protocol_recommendations(approved_at DESC);

-- ===========================================
-- COMMENTS
-- ===========================================
COMMENT ON COLUMN public.protocol_recommendations.approved_at IS 'When the practitioner approved this recommendation';
COMMENT ON COLUMN public.protocol_recommendations.approved_by IS 'Which practitioner approved this recommendation';

-- ===========================================
-- SUCCESS
-- ===========================================
DO $$
BEGIN
    RAISE NOTICE 'Migration complete: Protocol recommendation approval workflow added';
END $$;
