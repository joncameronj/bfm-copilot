-- Migration: Chat Evaluation Mode System
-- Enables Dr. Rob and JonCameron to evaluate agent responses with a 4-tier rating system
-- instead of simple thumbs up/down feedback

-- ============================================
-- Chat Evaluations Table
-- ============================================
-- Stores 4-tier evaluations of agent responses from eval mode users

CREATE TABLE IF NOT EXISTS public.chat_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source references
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,

    -- Evaluator info
    evaluator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- Content type being evaluated
    content_type TEXT NOT NULL CHECK (content_type IN ('chat_response', 'protocol', 'patient_analysis')),

    -- 4-tier rating system
    rating TEXT NOT NULL CHECK (rating IN ('correct', 'partially_correct', 'partially_fail', 'fail')),

    -- Structured feedback (two comment fields)
    correct_aspects TEXT,              -- "What was correct/good"
    needs_adjustment TEXT,             -- "What needs adjustment" (REQUIRED for non-correct ratings)

    -- Context metadata (denormalized for convenience)
    message_content TEXT NOT NULL,     -- Snapshot of evaluated content
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,

    -- System metadata
    is_eval_mode BOOLEAN DEFAULT TRUE, -- TRUE = eval mode, FALSE = converted regular feedback
    metadata JSONB DEFAULT '{}',       -- Extensible for future needs

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_chat_evaluations_message_id
    ON public.chat_evaluations(message_id);

CREATE INDEX IF NOT EXISTS idx_chat_evaluations_conversation_id
    ON public.chat_evaluations(conversation_id);

CREATE INDEX IF NOT EXISTS idx_chat_evaluations_evaluator_id
    ON public.chat_evaluations(evaluator_id);

CREATE INDEX IF NOT EXISTS idx_chat_evaluations_patient_id
    ON public.chat_evaluations(patient_id);

-- Filter/query indexes
CREATE INDEX IF NOT EXISTS idx_chat_evaluations_rating
    ON public.chat_evaluations(rating);

CREATE INDEX IF NOT EXISTS idx_chat_evaluations_content_type
    ON public.chat_evaluations(content_type);

CREATE INDEX IF NOT EXISTS idx_chat_evaluations_created_at
    ON public.chat_evaluations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_evaluations_is_eval_mode
    ON public.chat_evaluations(is_eval_mode);

-- Composite index for admin queries
CREATE INDEX IF NOT EXISTS idx_chat_evaluations_admin_query
    ON public.chat_evaluations(is_eval_mode, content_type, rating, created_at DESC);

-- ============================================
-- Add eval_mode_enabled to user_preferences
-- ============================================

ALTER TABLE public.user_preferences
    ADD COLUMN IF NOT EXISTS eval_mode_enabled BOOLEAN DEFAULT FALSE;

-- Create index for finding eval mode users
CREATE INDEX IF NOT EXISTS idx_user_preferences_eval_mode
    ON public.user_preferences(eval_mode_enabled)
    WHERE eval_mode_enabled = TRUE;

-- ============================================
-- Initialize eval_mode for specific users
-- ============================================

-- Set eval_mode_enabled = TRUE for Dr. Rob and JonCameron
-- First, update existing preferences
UPDATE public.user_preferences
SET eval_mode_enabled = TRUE
WHERE user_id IN (
    SELECT id FROM public.profiles
    WHERE email IN ('drrob@shslasvegas.com', 'joncameron@etho.net')
);

-- Insert preferences if they don't exist for these users
INSERT INTO public.user_preferences (user_id, eval_mode_enabled)
SELECT p.id, TRUE
FROM public.profiles p
WHERE p.email IN ('drrob@shslasvegas.com', 'joncameron@etho.net')
AND NOT EXISTS (
    SELECT 1 FROM public.user_preferences up WHERE up.user_id = p.id
)
ON CONFLICT (user_id) DO UPDATE SET eval_mode_enabled = TRUE;

-- ============================================
-- Validation Function
-- ============================================
-- Ensures needs_adjustment is provided for non-correct ratings

CREATE OR REPLACE FUNCTION validate_chat_evaluation()
RETURNS TRIGGER AS $$
BEGIN
    -- Require needs_adjustment comment for non-correct ratings
    IF NEW.rating != 'correct' AND (NEW.needs_adjustment IS NULL OR TRIM(NEW.needs_adjustment) = '') THEN
        RAISE EXCEPTION 'Comment required for non-correct ratings: needs_adjustment field must be provided';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS chat_evaluation_validation ON public.chat_evaluations;
CREATE TRIGGER chat_evaluation_validation
    BEFORE INSERT OR UPDATE ON public.chat_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION validate_chat_evaluation();

-- ============================================
-- Updated_at Trigger
-- ============================================

DROP TRIGGER IF EXISTS chat_evaluations_updated_at ON public.chat_evaluations;
CREATE TRIGGER chat_evaluations_updated_at
    BEFORE UPDATE ON public.chat_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Statistics View
-- ============================================

CREATE OR REPLACE VIEW public.chat_evaluation_stats AS
SELECT
    DATE_TRUNC('day', ce.created_at) AS eval_date,
    ce.content_type,
    ce.rating,
    ce.is_eval_mode,
    COUNT(*) AS total_evaluations,
    COUNT(DISTINCT ce.evaluator_id) AS unique_evaluators,
    COUNT(DISTINCT ce.conversation_id) AS unique_conversations,
    AVG(LENGTH(COALESCE(ce.needs_adjustment, ''))) AS avg_comment_length,
    p.email AS evaluator_email,
    p.full_name AS evaluator_name
FROM public.chat_evaluations ce
LEFT JOIN public.profiles p ON ce.evaluator_id = p.id
GROUP BY
    DATE_TRUNC('day', ce.created_at),
    ce.content_type,
    ce.rating,
    ce.is_eval_mode,
    p.email,
    p.full_name;

-- Grant access to authenticated users
GRANT SELECT ON public.chat_evaluation_stats TO authenticated;

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE public.chat_evaluations ENABLE ROW LEVEL SECURITY;

-- Policy: Admins and practitioners can view all evaluations
CREATE POLICY "Admins and practitioners can view chat evaluations"
    ON public.chat_evaluations
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'practitioner')
        )
    );

-- Policy: Only eval mode users can submit evaluations
CREATE POLICY "Eval mode users can submit evaluations"
    ON public.chat_evaluations
    FOR INSERT
    TO authenticated
    WITH CHECK (
        evaluator_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.user_preferences
            WHERE user_id = auth.uid()
            AND eval_mode_enabled = TRUE
        )
    );

-- Policy: Evaluators can update their own evaluations (within 24 hours)
CREATE POLICY "Evaluators can update own evaluations"
    ON public.chat_evaluations
    FOR UPDATE
    TO authenticated
    USING (
        evaluator_id = auth.uid()
        AND created_at > NOW() - INTERVAL '24 hours'
    )
    WITH CHECK (
        evaluator_id = auth.uid()
    );

-- No DELETE policy - retain all evaluation data

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE public.chat_evaluations IS 'Stores 4-tier evaluations of agent responses from eval mode users';
COMMENT ON COLUMN public.chat_evaluations.rating IS 'Rating tier: correct, partially_correct, partially_fail, or fail';
COMMENT ON COLUMN public.chat_evaluations.correct_aspects IS 'User feedback on what was correct about the response';
COMMENT ON COLUMN public.chat_evaluations.needs_adjustment IS 'User feedback on what needs adjustment (required for non-correct ratings)';
COMMENT ON COLUMN public.chat_evaluations.content_type IS 'Type of content being evaluated: chat_response, protocol, or patient_analysis';
COMMENT ON COLUMN public.chat_evaluations.is_eval_mode IS 'TRUE if submitted via eval mode, FALSE if converted from regular feedback';
COMMENT ON VIEW public.chat_evaluation_stats IS 'Aggregated statistics for chat evaluation analysis';
COMMENT ON FUNCTION validate_chat_evaluation IS 'Validates that non-correct ratings include a needs_adjustment comment';
