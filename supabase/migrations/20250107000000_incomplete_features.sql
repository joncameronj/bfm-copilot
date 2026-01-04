-- ===========================================
-- PHASE 2, 3, 5, 6 INCOMPLETE PRD FEATURES
-- ===========================================

-- ============================================
-- PHASE 2: Profile Avatar URL
-- ============================================
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ============================================
-- PHASE 2: Archived Conversations
-- ============================================
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_conversations_archived ON public.conversations(is_archived);

-- ============================================
-- PHASE 3: Recommendations Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded')),
    parent_recommendation_id UUID REFERENCES public.recommendations(id) ON DELETE SET NULL,
    iteration_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON public.recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON public.recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_conversation_id ON public.recommendations(conversation_id);

-- ============================================
-- PHASE 3: Recommendation Feedback Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.recommendation_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating TEXT NOT NULL CHECK (rating IN ('thumbs_up', 'thumbs_down')),
    feedback_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recommendation_feedback_recommendation_id ON public.recommendation_feedback(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_feedback_user_id ON public.recommendation_feedback(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_feedback ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users manage own recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Users manage own recommendation feedback" ON public.recommendation_feedback;

-- Recommendations policies
CREATE POLICY "Users manage own recommendations" ON public.recommendations
    FOR ALL USING (user_id = auth.uid());

-- Recommendation feedback policies
CREATE POLICY "Users manage own recommendation feedback" ON public.recommendation_feedback
    FOR ALL USING (user_id = auth.uid());

-- ============================================
-- Trigger for updated_at on recommendations
-- ============================================
DROP TRIGGER IF EXISTS recommendations_updated_at ON public.recommendations;
CREATE TRIGGER recommendations_updated_at BEFORE UPDATE ON public.recommendations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Phase 2, 3, 5, 6 features migration complete!';
END $$;
