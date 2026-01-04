-- Migration: RAG Evaluation System
-- Enables Dr. Rob to evaluate agent responses for accuracy and improvement

-- ============================================
-- Evaluation Sessions Table
-- ============================================
-- Groups evaluations into testing sessions

CREATE TABLE IF NOT EXISTS public.evaluation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evaluation_sessions_status
    ON public.evaluation_sessions(status);

CREATE INDEX IF NOT EXISTS idx_evaluation_sessions_created_by
    ON public.evaluation_sessions(created_by);

-- ============================================
-- RAG Evaluations Table
-- ============================================
-- Stores practitioner evaluations of agent responses

CREATE TABLE IF NOT EXISTS public.rag_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to source data
    rag_log_id UUID REFERENCES public.rag_logs(id) ON DELETE SET NULL,
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,

    -- Evaluation session
    evaluation_session_id UUID REFERENCES public.evaluation_sessions(id) ON DELETE SET NULL,

    -- Evaluator
    evaluator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- The original query and response (denormalized for export convenience)
    query_text TEXT NOT NULL,
    response_text TEXT NOT NULL,
    sources_cited JSONB DEFAULT '[]',

    -- Care category context
    care_category TEXT CHECK (care_category IN ('diabetes', 'thyroid', 'hormones', 'neurological', 'general')),

    -- Evaluation scores
    accuracy_score INTEGER NOT NULL CHECK (accuracy_score BETWEEN 1 AND 5),
    source_quality_score INTEGER CHECK (source_quality_score BETWEEN 1 AND 5),

    -- Feedback
    comment TEXT,
    improvement_suggestion TEXT,

    -- Issue tags for categorization
    issue_tags TEXT[] DEFAULT '{}',
    -- Example tags: 'incorrect_source', 'missing_info', 'outdated_protocol',
    -- 'wrong_dosage', 'hallucination', 'out_of_scope', 'excellent'

    -- Metadata
    response_time_ms INTEGER,
    user_role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rag_evaluations_rag_log
    ON public.rag_evaluations(rag_log_id);

CREATE INDEX IF NOT EXISTS idx_rag_evaluations_session
    ON public.rag_evaluations(evaluation_session_id);

CREATE INDEX IF NOT EXISTS idx_rag_evaluations_score
    ON public.rag_evaluations(accuracy_score);

CREATE INDEX IF NOT EXISTS idx_rag_evaluations_created
    ON public.rag_evaluations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rag_evaluations_evaluator
    ON public.rag_evaluations(evaluator_id);

CREATE INDEX IF NOT EXISTS idx_rag_evaluations_care_category
    ON public.rag_evaluations(care_category);

-- ============================================
-- Update rag_logs to track evaluation status
-- ============================================

ALTER TABLE public.rag_logs
    ADD COLUMN IF NOT EXISTS is_evaluated BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS evaluation_id UUID REFERENCES public.rag_evaluations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rag_logs_is_evaluated
    ON public.rag_logs(is_evaluated);

-- ============================================
-- Evaluation Statistics View
-- ============================================

CREATE OR REPLACE VIEW public.evaluation_stats AS
SELECT
    DATE_TRUNC('day', e.created_at) AS eval_date,
    e.care_category,
    e.evaluation_session_id,
    COUNT(*) AS total_evaluations,
    ROUND(AVG(e.accuracy_score)::numeric, 2) AS avg_accuracy,
    ROUND(AVG(e.source_quality_score)::numeric, 2) AS avg_source_quality,
    COUNT(CASE WHEN e.accuracy_score <= 2 THEN 1 END) AS low_scores,
    COUNT(CASE WHEN e.accuracy_score >= 4 THEN 1 END) AS high_scores
FROM public.rag_evaluations e
GROUP BY DATE_TRUNC('day', e.created_at), e.care_category, e.evaluation_session_id;

-- ============================================
-- Function to get unevaluated logs
-- ============================================

CREATE OR REPLACE FUNCTION get_unevaluated_rag_logs(
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0,
    p_care_category TEXT DEFAULT NULL
)
RETURNS TABLE (
    log_id UUID,
    conversation_id UUID,
    query_text TEXT,
    search_results JSONB,
    response_time_ms INTEGER,
    user_role TEXT,
    care_category TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        rl.id AS log_id,
        rl.conversation_id,
        rl.query AS query_text,
        rl.search_results,
        rl.response_time_ms,
        rl.user_role,
        COALESCE(
            (rl.search_results->0->>'care_category')::TEXT,
            'general'
        ) AS care_category,
        rl.created_at
    FROM public.rag_logs rl
    WHERE rl.is_evaluated = FALSE
      AND (p_care_category IS NULL OR
           (rl.search_results->0->>'care_category') = p_care_category)
    ORDER BY rl.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- ============================================
-- Function to submit evaluation
-- ============================================

CREATE OR REPLACE FUNCTION submit_evaluation(
    p_rag_log_id UUID,
    p_evaluator_id UUID,
    p_query_text TEXT,
    p_response_text TEXT,
    p_accuracy_score INTEGER,
    p_comment TEXT DEFAULT NULL,
    p_improvement_suggestion TEXT DEFAULT NULL,
    p_source_quality_score INTEGER DEFAULT NULL,
    p_issue_tags TEXT[] DEFAULT '{}',
    p_sources_cited JSONB DEFAULT '[]',
    p_session_id UUID DEFAULT NULL,
    p_care_category TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_evaluation_id UUID;
BEGIN
    -- Insert evaluation
    INSERT INTO public.rag_evaluations (
        rag_log_id,
        evaluation_session_id,
        evaluator_id,
        query_text,
        response_text,
        accuracy_score,
        source_quality_score,
        comment,
        improvement_suggestion,
        issue_tags,
        sources_cited,
        care_category
    ) VALUES (
        p_rag_log_id,
        p_session_id,
        p_evaluator_id,
        p_query_text,
        p_response_text,
        p_accuracy_score,
        p_source_quality_score,
        p_comment,
        p_improvement_suggestion,
        p_issue_tags,
        p_sources_cited,
        p_care_category
    )
    RETURNING id INTO v_evaluation_id;

    -- Mark rag_log as evaluated
    UPDATE public.rag_logs
    SET is_evaluated = TRUE,
        evaluation_id = v_evaluation_id
    WHERE id = p_rag_log_id;

    RETURN v_evaluation_id;
END;
$$;

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE public.evaluation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_evaluations ENABLE ROW LEVEL SECURITY;

-- Only admins and practitioners can manage evaluation sessions
CREATE POLICY "Practitioners can manage evaluation sessions" ON public.evaluation_sessions
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'practitioner')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'practitioner')
        )
    );

-- Only admins and practitioners can manage evaluations
CREATE POLICY "Practitioners can manage evaluations" ON public.rag_evaluations
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'practitioner')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'practitioner')
        )
    );

-- ============================================
-- Trigger to update updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evaluation_sessions_updated_at
    BEFORE UPDATE ON public.evaluation_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER rag_evaluations_updated_at
    BEFORE UPDATE ON public.rag_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE public.evaluation_sessions IS 'Groups evaluations into testing periods for analysis';
COMMENT ON TABLE public.rag_evaluations IS 'Practitioner evaluations of agent responses with scores and feedback';
COMMENT ON VIEW public.evaluation_stats IS 'Aggregated statistics for evaluation performance';
COMMENT ON FUNCTION get_unevaluated_rag_logs IS 'Get RAG logs that have not been evaluated yet';
COMMENT ON FUNCTION submit_evaluation IS 'Submit an evaluation and mark the RAG log as evaluated';
