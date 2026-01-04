-- ===========================================
-- DIAGNOSTIC ANALYSIS PIPELINE
-- ===========================================
-- This migration adds:
-- 1. diagnostic_analyses table (AI-generated analysis from diagnostics)
-- 2. protocol_recommendations table (AI-recommended protocols with FSM frequencies)
-- 3. protocol_executions table (practitioner execution logging with outcomes)
-- ===========================================

-- ============================================
-- DIAGNOSTIC ANALYSES (AI-generated from diagnostic uploads)
-- ============================================
CREATE TABLE public.diagnostic_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diagnostic_upload_id UUID NOT NULL REFERENCES public.diagnostic_uploads(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    practitioner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- AI-generated content in "Dr. Rob's voice"
    summary TEXT NOT NULL,  -- Explanation with analogies
    raw_analysis JSONB DEFAULT '{}',  -- Structured analysis data

    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',     -- Analysis queued
        'processing',  -- RAG analysis in progress
        'complete',    -- Analysis finished
        'error'        -- Analysis failed
    )),
    error_message TEXT,

    -- RAG context used for generation
    rag_context JSONB DEFAULT '{}',  -- Document chunks used

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROTOCOL RECOMMENDATIONS (AI-generated from analysis)
-- ============================================
CREATE TABLE public.protocol_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diagnostic_analysis_id UUID NOT NULL REFERENCES public.diagnostic_analyses(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,

    -- Protocol content
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general' CHECK (category IN (
        'general', 'detox', 'hormone', 'gut', 'immune', 'metabolic', 'neurological'
    )),

    -- FSM frequencies (array of frequency references)
    -- Format: [{id, name, frequency_a, frequency_b, rationale}]
    recommended_frequencies JSONB DEFAULT '[]',

    -- Supplementation (only populated if labs exist)
    -- Format: [{name, dosage, timing, rationale}]
    supplementation JSONB DEFAULT '[]',

    -- Priority/order in the list (1 = highest priority)
    priority INTEGER DEFAULT 1,

    -- Status tracking
    status TEXT DEFAULT 'recommended' CHECK (status IN (
        'recommended',  -- AI suggested, not yet acted upon
        'executed',     -- Protocol was run by practitioner
        'declined'      -- Practitioner declined this recommendation
    )),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROTOCOL EXECUTIONS (practitioner logs running a protocol)
-- ============================================
CREATE TABLE public.protocol_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_recommendation_id UUID NOT NULL REFERENCES public.protocol_recommendations(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    practitioner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- Execution details
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    frequencies_used JSONB DEFAULT '[]',  -- Actual frequencies used (may differ from recommended)
    duration_minutes INTEGER,
    notes TEXT,

    -- Outcome (recorded later by practitioner)
    outcome TEXT CHECK (outcome IN ('positive', 'negative', 'neutral', 'pending')),
    outcome_notes TEXT,
    outcome_recorded_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_diagnostic_analyses_upload_id ON public.diagnostic_analyses(diagnostic_upload_id);
CREATE INDEX idx_diagnostic_analyses_patient_id ON public.diagnostic_analyses(patient_id);
CREATE INDEX idx_diagnostic_analyses_practitioner_id ON public.diagnostic_analyses(practitioner_id);
CREATE INDEX idx_diagnostic_analyses_status ON public.diagnostic_analyses(status);
CREATE INDEX idx_diagnostic_analyses_created_at ON public.diagnostic_analyses(created_at DESC);

CREATE INDEX idx_protocol_recommendations_analysis_id ON public.protocol_recommendations(diagnostic_analysis_id);
CREATE INDEX idx_protocol_recommendations_patient_id ON public.protocol_recommendations(patient_id);
CREATE INDEX idx_protocol_recommendations_status ON public.protocol_recommendations(status);
CREATE INDEX idx_protocol_recommendations_priority ON public.protocol_recommendations(priority);

CREATE INDEX idx_protocol_executions_recommendation_id ON public.protocol_executions(protocol_recommendation_id);
CREATE INDEX idx_protocol_executions_patient_id ON public.protocol_executions(patient_id);
CREATE INDEX idx_protocol_executions_practitioner_id ON public.protocol_executions(practitioner_id);
CREATE INDEX idx_protocol_executions_executed_at ON public.protocol_executions(executed_at DESC);
CREATE INDEX idx_protocol_executions_outcome ON public.protocol_executions(outcome);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.diagnostic_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_executions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Diagnostic Analyses: Practitioners manage their own analyses
CREATE POLICY "Practitioners manage own diagnostic analyses" ON public.diagnostic_analyses
    FOR ALL USING (practitioner_id = auth.uid());

-- Protocol Recommendations: Access via diagnostic analysis ownership
CREATE POLICY "Practitioners access protocol recommendations" ON public.protocol_recommendations
    FOR ALL USING (
        diagnostic_analysis_id IN (
            SELECT id FROM public.diagnostic_analyses WHERE practitioner_id = auth.uid()
        )
    );

-- Protocol Executions: Practitioners manage their own executions
CREATE POLICY "Practitioners manage own protocol executions" ON public.protocol_executions
    FOR ALL USING (practitioner_id = auth.uid());

-- Admin policies: Admins can read all for analytics
CREATE POLICY "Admins read all diagnostic analyses" ON public.diagnostic_analyses
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins read all protocol recommendations" ON public.protocol_recommendations
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins read all protocol executions" ON public.protocol_executions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER diagnostic_analyses_updated_at BEFORE UPDATE ON public.diagnostic_analyses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER protocol_recommendations_updated_at BEFORE UPDATE ON public.protocol_recommendations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER protocol_executions_updated_at BEFORE UPDATE ON public.protocol_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- UPDATE USAGE EVENTS FOR NEW EVENT TYPES
-- ============================================
ALTER TABLE public.usage_events DROP CONSTRAINT IF EXISTS usage_events_event_type_check;
ALTER TABLE public.usage_events ADD CONSTRAINT usage_events_event_type_check
    CHECK (event_type IN (
        'login',
        'lab_analysis',
        'protocol_generated',
        'protocol_feedback_submitted',
        'suggestion_generated',
        'suggestion_feedback_submitted',
        'conversation_started',
        'diagnostic_uploaded',
        'patient_created',
        'feedback_submitted',
        'member_lab_entered',
        'diagnostic_analysis_generated',
        'protocol_recommendation_executed',
        'protocol_outcome_recorded'
    ));

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration complete: diagnostic_analyses, protocol_recommendations, and protocol_executions tables created.';
END $$;
