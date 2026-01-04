-- ===========================================
-- SUGGESTIONS, PROTOCOLS, AND MEMBER LAB VALUES
-- ===========================================
-- This migration adds:
-- 1. Suggestions table (member self-service wellness suggestions)
-- 2. Suggestion feedback table
-- 3. Protocols table (practitioner clinical protocols)
-- 4. Protocol feedback table
-- 5. Member lab values table (personal health tracking for members)
-- ===========================================

-- ============================================
-- SUGGESTIONS (for members - softer, non-clinical language)
-- ============================================
CREATE TABLE public.suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'general' CHECK (category IN (
        'general', 'nutrition', 'lifestyle', 'supplement', 'exercise', 'sleep', 'stress'
    )),
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',     -- Suggestion generated, awaiting member action
        'accepted',    -- Member accepted/tried the suggestion
        'rejected',    -- Member declined the suggestion
        'superseded'   -- New suggestion replaced this one
    )),
    source_context JSONB DEFAULT '{}', -- Lab values, health data that prompted this
    iteration_count INTEGER DEFAULT 1, -- How many times this suggestion has been refined
    parent_suggestion_id UUID REFERENCES public.suggestions(id) ON DELETE SET NULL, -- For iteration tracking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUGGESTION FEEDBACK (member feedback on suggestions)
-- ============================================
CREATE TABLE public.suggestion_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suggestion_id UUID NOT NULL REFERENCES public.suggestions(id) ON DELETE CASCADE,
    rating TEXT NOT NULL CHECK (rating IN ('thumbs_up', 'thumbs_down')),
    feedback_text TEXT, -- "What happened?" free-form response
    outcome TEXT CHECK (outcome IN (
        'helped',       -- Suggestion improved member's health
        'no_change',    -- No noticeable effect
        'made_worse',   -- Suggestion had negative effect
        'too_difficult' -- Could not follow the suggestion
    )),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROTOCOLS (for practitioners - clinical terminology)
-- ============================================
CREATE TABLE public.protocols (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practitioner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content JSONB NOT NULL, -- Structured protocol data (steps, dosages, timing, etc.)
    category TEXT DEFAULT 'general' CHECK (category IN (
        'general', 'detox', 'hormone', 'gut', 'immune', 'metabolic', 'neurological'
    )),
    status TEXT DEFAULT 'active' CHECK (status IN (
        'draft',      -- Protocol in development
        'active',     -- Currently being followed by patient
        'completed',  -- Protocol finished
        'archived',   -- No longer active, kept for records
        'superseded'  -- New protocol replaced this one
    )),
    duration_days INTEGER, -- Expected protocol duration
    start_date DATE,
    end_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROTOCOL FEEDBACK (practitioner feedback on protocol outcomes)
-- ============================================
CREATE TABLE public.protocol_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_id UUID NOT NULL REFERENCES public.protocols(id) ON DELETE CASCADE,
    practitioner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    outcome TEXT NOT NULL CHECK (outcome IN (
        'positive',   -- Patient improved
        'negative',   -- Patient got worse
        'neutral',    -- No significant change
        'partial'     -- Some improvement but not complete
    )),
    outcome_text TEXT, -- Detailed description of patient outcome
    adjustments_made TEXT, -- What changes were made during the protocol
    rating TEXT CHECK (rating IN ('thumbs_up', 'thumbs_down')),
    lab_comparison JSONB, -- Before/after lab values comparison
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MEMBER LAB VALUES (personal health tracking for members)
-- This is separate from the practitioner-managed lab_results/lab_values
-- Members can manually enter their own lab values for personal tracking
-- ============================================
CREATE TABLE public.member_lab_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    marker_name TEXT NOT NULL, -- Display name of the marker
    marker_id UUID REFERENCES public.lab_markers(id) ON DELETE SET NULL, -- Optional link to standard marker
    value DECIMAL NOT NULL,
    unit TEXT NOT NULL,
    reference_range TEXT, -- Member-entered reference range (e.g., "4.0-5.5")
    test_date DATE NOT NULL,
    lab_name TEXT, -- Where the test was done
    notes TEXT,
    source TEXT DEFAULT 'manual' CHECK (source IN (
        'manual',     -- Member entered manually
        'pdf_upload', -- Parsed from uploaded PDF
        'imported'    -- Imported from other source
    )),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_suggestions_user_id ON public.suggestions(user_id);
CREATE INDEX idx_suggestions_status ON public.suggestions(status);
CREATE INDEX idx_suggestions_created_at ON public.suggestions(created_at DESC);
CREATE INDEX idx_suggestions_parent ON public.suggestions(parent_suggestion_id);

CREATE INDEX idx_suggestion_feedback_suggestion_id ON public.suggestion_feedback(suggestion_id);
CREATE INDEX idx_suggestion_feedback_rating ON public.suggestion_feedback(rating);

CREATE INDEX idx_protocols_practitioner_id ON public.protocols(practitioner_id);
CREATE INDEX idx_protocols_patient_id ON public.protocols(patient_id);
CREATE INDEX idx_protocols_status ON public.protocols(status);
CREATE INDEX idx_protocols_created_at ON public.protocols(created_at DESC);

CREATE INDEX idx_protocol_feedback_protocol_id ON public.protocol_feedback(protocol_id);
CREATE INDEX idx_protocol_feedback_outcome ON public.protocol_feedback(outcome);

CREATE INDEX idx_member_lab_values_user_id ON public.member_lab_values(user_id);
CREATE INDEX idx_member_lab_values_test_date ON public.member_lab_values(test_date DESC);
CREATE INDEX idx_member_lab_values_marker_name ON public.member_lab_values(marker_name);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestion_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_lab_values ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Suggestions: Members can only see their own
CREATE POLICY "Members manage own suggestions" ON public.suggestions
    FOR ALL USING (user_id = auth.uid());

-- Suggestion Feedback: Members can only see feedback for their own suggestions
CREATE POLICY "Members manage own suggestion feedback" ON public.suggestion_feedback
    FOR ALL USING (
        suggestion_id IN (SELECT id FROM public.suggestions WHERE user_id = auth.uid())
    );

-- Protocols: Practitioners manage their own protocols
CREATE POLICY "Practitioners manage own protocols" ON public.protocols
    FOR ALL USING (practitioner_id = auth.uid());

-- Protocol Feedback: Practitioners manage feedback for their own protocols
CREATE POLICY "Practitioners manage own protocol feedback" ON public.protocol_feedback
    FOR ALL USING (practitioner_id = auth.uid());

-- Member Lab Values: Members can only see their own
CREATE POLICY "Members manage own lab values" ON public.member_lab_values
    FOR ALL USING (user_id = auth.uid());

-- Admin policies: Admins can read all for analytics
CREATE POLICY "Admins read all suggestions" ON public.suggestions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins read all suggestion feedback" ON public.suggestion_feedback
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins read all protocols" ON public.protocols
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins read all protocol feedback" ON public.protocol_feedback
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins read all member lab values" ON public.member_lab_values
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER suggestions_updated_at BEFORE UPDATE ON public.suggestions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER protocols_updated_at BEFORE UPDATE ON public.protocols
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER member_lab_values_updated_at BEFORE UPDATE ON public.member_lab_values
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
        'member_lab_entered'
    ));

-- ============================================
-- ADD avatar_url TO PROFILES (from PRD V2)
-- ============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration complete: suggestions, protocols, and member_lab_values tables created.';
END $$;
