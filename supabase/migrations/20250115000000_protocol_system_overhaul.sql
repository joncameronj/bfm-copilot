-- ===========================================
-- PROTOCOL SYSTEM OVERHAUL
-- ===========================================
-- This migration addresses protocol hallucination and RAG priority issues:
-- 1. Adds seminar_day column to identify Sunday docs (tactical case studies)
-- 2. Creates approved_frequency_names table (frequency validation)
-- 3. Creates frequency_reference_images table (admin uploads)
-- 4. Creates diagnostic_extracted_values table (Vision API extraction)
-- 5. Creates recommendation_reasoning table (explainability)
-- 6. Creates prioritized_search_documents function (Sunday-first RAG)
-- 7. Extends diagnostic_type enum (urinalysis, vcs, brainwave)
-- ===========================================

-- ============================================
-- 1. ADD SEMINAR_DAY TO DOCUMENTS TABLE
-- ============================================

-- Add seminar_day column to identify which day the seminar was held
ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS seminar_day TEXT;

-- Add constraint for seminar day values
ALTER TABLE public.documents
    ADD CONSTRAINT check_seminar_day CHECK (
        seminar_day IS NULL OR seminar_day IN ('friday', 'saturday', 'sunday')
    );

-- Index for fast Sunday doc lookups
CREATE INDEX IF NOT EXISTS idx_documents_seminar_day
    ON public.documents(seminar_day);

-- Backfill seminar_day from existing filenames
UPDATE public.documents
SET seminar_day = CASE
    WHEN LOWER(filename) LIKE '%sun%' OR LOWER(title) LIKE '%sun%' THEN 'sunday'
    WHEN LOWER(filename) LIKE '%sat%' OR LOWER(title) LIKE '%sat%' THEN 'saturday'
    WHEN LOWER(filename) LIKE '%fri%' OR LOWER(title) LIKE '%fri%' THEN 'friday'
    ELSE NULL
END
WHERE document_category = 'seminar_transcript' AND seminar_day IS NULL;

-- ============================================
-- 2. APPROVED FREQUENCY NAMES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.approved_frequency_names (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    aliases TEXT[] DEFAULT '{}',
    category TEXT,  -- Optional grouping (e.g., 'inflammation', 'detox', 'nerve')
    description TEXT,
    source_image_id UUID,  -- Reference to frequency_reference_images
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES public.profiles(id),
    verified_by UUID REFERENCES public.profiles(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_frequency_name UNIQUE (name)
);

-- Indexes for frequency lookup
CREATE INDEX IF NOT EXISTS idx_approved_frequency_names_name
    ON public.approved_frequency_names(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_approved_frequency_names_active
    ON public.approved_frequency_names(is_active);
CREATE INDEX IF NOT EXISTS idx_approved_frequency_names_category
    ON public.approved_frequency_names(category);

-- ============================================
-- 3. FREQUENCY REFERENCE IMAGES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.frequency_reference_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    category TEXT,  -- e.g., 'hormones', 'neurological', 'thyroid', 'diabetes'
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Uploaded, not yet extracted
        'processing',   -- Vision API extraction in progress
        'extracted',    -- Extraction complete
        'error'         -- Extraction failed
    )),
    extracted_names JSONB DEFAULT '[]',  -- Raw extraction result from Vision API
    extraction_confidence NUMERIC(3,2),
    error_message TEXT,
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key reference from approved_frequency_names
ALTER TABLE public.approved_frequency_names
    ADD CONSTRAINT fk_source_image
    FOREIGN KEY (source_image_id)
    REFERENCES public.frequency_reference_images(id)
    ON DELETE SET NULL;

-- Index for admin lookups
CREATE INDEX IF NOT EXISTS idx_frequency_reference_images_status
    ON public.frequency_reference_images(status);
CREATE INDEX IF NOT EXISTS idx_frequency_reference_images_uploaded_by
    ON public.frequency_reference_images(uploaded_by);

-- ============================================
-- 4. DIAGNOSTIC EXTRACTED VALUES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.diagnostic_extracted_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diagnostic_file_id UUID NOT NULL REFERENCES public.diagnostic_files(id) ON DELETE CASCADE,

    -- Extraction metadata
    extraction_method TEXT NOT NULL DEFAULT 'vision_api' CHECK (
        extraction_method IN ('vision_api', 'pdf_parser', 'manual')
    ),
    extraction_model TEXT,  -- e.g., 'claude-sonnet-4-6'
    extraction_confidence NUMERIC(3,2),  -- 0.00 to 1.00

    -- Structured extracted data (schema varies by file_type)
    -- HRV: {patterns: {sympathetic_dominance, parasympathetic_dominance}, findings: [...]}
    -- D-Pulse: {deal_breakers: [...], caution_areas: [...], green_count, yellow_count, red_count}
    -- UA: {ph: {value, status}, protein: {value, status}, specific_gravity: {...}}
    -- VCS: {passed: bool, right_eye: {...}, left_eye: {...}, biotoxin_likely: bool}
    extracted_data JSONB NOT NULL DEFAULT '{}',

    -- Raw Vision API response for debugging
    raw_response JSONB DEFAULT '{}',

    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Not yet extracted
        'processing',   -- Extraction in progress
        'complete',     -- Extraction successful
        'error',        -- Extraction failed
        'needs_review'  -- Low confidence, needs practitioner review
    )),
    error_message TEXT,

    -- Practitioner review for low-confidence extractions
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_diagnostic_extracted_values_file_id
    ON public.diagnostic_extracted_values(diagnostic_file_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_extracted_values_status
    ON public.diagnostic_extracted_values(status);
CREATE INDEX IF NOT EXISTS idx_diagnostic_extracted_values_created_at
    ON public.diagnostic_extracted_values(created_at DESC);

-- ============================================
-- 5. RECOMMENDATION REASONING TABLE (Explainability)
-- ============================================

CREATE TABLE IF NOT EXISTS public.recommendation_reasoning (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_recommendation_id UUID NOT NULL REFERENCES public.protocol_recommendations(id) ON DELETE CASCADE,
    frequency_name TEXT NOT NULL,

    -- Source attribution
    rag_chunks_used JSONB DEFAULT '[]',  -- [{chunk_id, document_id, title, content_snippet, similarity}]
    sunday_doc_references JSONB DEFAULT '[]',  -- [{filename, section, quote}]

    -- Diagnostic triggers
    diagnostic_triggers JSONB DEFAULT '[]',  -- [{type, finding, value, interpretation}]
    patient_conditions TEXT[],  -- Matched conditions from patient context

    -- AI reasoning chain
    reasoning_steps JSONB DEFAULT '[]',  -- Step-by-step logic
    confidence_score FLOAT,  -- AI's confidence in this recommendation (0-1)

    -- Validation
    validated BOOLEAN DEFAULT FALSE,  -- Whether frequency was validated against approved list
    validation_error TEXT,  -- Error if validation failed

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for explainability queries
CREATE INDEX IF NOT EXISTS idx_recommendation_reasoning_protocol
    ON public.recommendation_reasoning(protocol_recommendation_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_reasoning_frequency
    ON public.recommendation_reasoning(frequency_name);

-- ============================================
-- 6. ADD EXPLAINABILITY_CONTEXT TO DIAGNOSTIC_ANALYSES
-- ============================================

ALTER TABLE public.diagnostic_analyses
    ADD COLUMN IF NOT EXISTS explainability_context JSONB DEFAULT '{}';

COMMENT ON COLUMN public.diagnostic_analyses.explainability_context IS 'Enhanced RAG context for explainability: Sunday docs used, diagnostic triggers, reasoning chain';

-- ============================================
-- 7. EXTEND DIAGNOSTIC_TYPE ENUM
-- ============================================

-- Add new values to diagnostic_type enum
ALTER TYPE diagnostic_type ADD VALUE IF NOT EXISTS 'nes_scan';
ALTER TYPE diagnostic_type ADD VALUE IF NOT EXISTS 'urinalysis';
ALTER TYPE diagnostic_type ADD VALUE IF NOT EXISTS 'vcs';
ALTER TYPE diagnostic_type ADD VALUE IF NOT EXISTS 'brainwave';

-- ============================================
-- 8. PRIORITIZED SEARCH DOCUMENTS FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION prioritized_search_documents(
    p_query_embedding vector(1536),
    p_user_id UUID,
    p_user_role TEXT DEFAULT 'practitioner',
    p_care_categories TEXT[] DEFAULT NULL,
    p_diagnostic_types TEXT[] DEFAULT NULL,
    p_match_threshold FLOAT DEFAULT 0.5,
    p_sunday_count INT DEFAULT 5,
    p_other_count INT DEFAULT 10
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    content TEXT,
    title TEXT,
    filename TEXT,
    care_category TEXT,
    document_category TEXT,
    seminar_day TEXT,
    similarity FLOAT,
    search_phase TEXT,
    priority_rank INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Phase 1: Sunday documents FIRST (tactical case study walkthroughs)
    -- These are the PRIMARY source of truth for protocol decisions
    RETURN QUERY
    SELECT
        dc.id AS chunk_id,
        dc.document_id,
        dc.content,
        d.title,
        d.filename,
        d.care_category,
        d.document_category,
        d.seminar_day,
        1 - (dc.embedding <=> p_query_embedding) AS similarity,
        'sunday_primary'::TEXT AS search_phase,
        1 AS priority_rank
    FROM public.document_chunks dc
    JOIN public.documents d ON dc.document_id = d.id
    WHERE d.status IN ('completed', 'indexed')
      AND (d.user_id = p_user_id OR d.is_global = TRUE)
      AND d.seminar_day = 'sunday'
      AND (p_care_categories IS NULL OR d.care_category = ANY(p_care_categories))
      AND 1 - (dc.embedding <=> p_query_embedding) > (p_match_threshold - 0.1)  -- Lower threshold for Sunday
      -- Role-based content filtering
      AND (
          p_user_role IN ('practitioner', 'admin')
          OR d.role_scope IN ('educational', 'both')
      )
    ORDER BY similarity DESC
    LIMIT p_sunday_count;

    -- Phase 2: Other seminar transcripts (Saturday/Friday)
    RETURN QUERY
    SELECT
        dc.id AS chunk_id,
        dc.document_id,
        dc.content,
        d.title,
        d.filename,
        d.care_category,
        d.document_category,
        d.seminar_day,
        1 - (dc.embedding <=> p_query_embedding) AS similarity,
        'seminar_secondary'::TEXT AS search_phase,
        2 AS priority_rank
    FROM public.document_chunks dc
    JOIN public.documents d ON dc.document_id = d.id
    WHERE d.status IN ('completed', 'indexed')
      AND (d.user_id = p_user_id OR d.is_global = TRUE)
      AND d.document_category = 'seminar_transcript'
      AND (d.seminar_day IS NULL OR d.seminar_day != 'sunday')
      AND (p_care_categories IS NULL OR d.care_category = ANY(p_care_categories))
      AND 1 - (dc.embedding <=> p_query_embedding) > p_match_threshold
      AND (
          p_user_role IN ('practitioner', 'admin')
          OR d.role_scope IN ('educational', 'both')
      )
    ORDER BY similarity DESC
    LIMIT GREATEST(p_other_count / 2, 3);

    -- Phase 3: Frequency reference documents
    RETURN QUERY
    SELECT
        dc.id AS chunk_id,
        dc.document_id,
        dc.content,
        d.title,
        d.filename,
        d.care_category,
        d.document_category,
        d.seminar_day,
        1 - (dc.embedding <=> p_query_embedding) AS similarity,
        'frequency_reference'::TEXT AS search_phase,
        3 AS priority_rank
    FROM public.document_chunks dc
    JOIN public.documents d ON dc.document_id = d.id
    WHERE d.status IN ('completed', 'indexed')
      AND (d.user_id = p_user_id OR d.is_global = TRUE)
      AND d.document_category = 'frequency_reference'
      AND (p_care_categories IS NULL OR d.care_category = ANY(p_care_categories))
      AND 1 - (dc.embedding <=> p_query_embedding) > p_match_threshold
      AND (
          p_user_role IN ('practitioner', 'admin')
          OR d.role_scope IN ('educational', 'both')
      )
    ORDER BY similarity DESC
    LIMIT 3;

    -- Phase 4: Other relevant documents (protocols, lab guides, etc.)
    RETURN QUERY
    SELECT
        dc.id AS chunk_id,
        dc.document_id,
        dc.content,
        d.title,
        d.filename,
        d.care_category,
        d.document_category,
        d.seminar_day,
        1 - (dc.embedding <=> p_query_embedding) AS similarity,
        'supplementary'::TEXT AS search_phase,
        4 AS priority_rank
    FROM public.document_chunks dc
    JOIN public.documents d ON dc.document_id = d.id
    WHERE d.status IN ('completed', 'indexed')
      AND (d.user_id = p_user_id OR d.is_global = TRUE)
      AND d.document_category NOT IN ('seminar_transcript', 'frequency_reference')
      AND (p_care_categories IS NULL OR d.care_category = ANY(p_care_categories))
      AND 1 - (dc.embedding <=> p_query_embedding) > p_match_threshold
      AND (
          p_user_role IN ('practitioner', 'admin')
          OR d.role_scope IN ('educational', 'both')
      )
    ORDER BY similarity DESC
    LIMIT p_other_count / 2;
END;
$$;

COMMENT ON FUNCTION prioritized_search_documents(vector(1536), UUID, TEXT, TEXT[], TEXT[], FLOAT, INT, INT)
    IS 'RAG search that prioritizes Sunday BFM transcripts first, then other seminars, then frequency references, then supplementary docs';

-- ============================================
-- 9. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.approved_frequency_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frequency_reference_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_extracted_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_reasoning ENABLE ROW LEVEL SECURITY;

-- Approved frequency names: Admins can manage, practitioners can read
CREATE POLICY "Admins manage approved frequencies" ON public.approved_frequency_names
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Practitioners read approved frequencies" ON public.approved_frequency_names
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'practitioner'))
    );

-- Frequency reference images: Only admins
CREATE POLICY "Admins manage frequency images" ON public.frequency_reference_images
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Diagnostic extracted values: Access through diagnostic file ownership
CREATE POLICY "Users access extracted values via files" ON public.diagnostic_extracted_values
    FOR ALL USING (
        diagnostic_file_id IN (
            SELECT df.id FROM public.diagnostic_files df
            JOIN public.diagnostic_uploads du ON df.upload_id = du.id
            WHERE du.user_id = auth.uid()
        )
    );

-- Recommendation reasoning: Access through protocol recommendation ownership
CREATE POLICY "Users access reasoning via recommendations" ON public.recommendation_reasoning
    FOR SELECT USING (
        protocol_recommendation_id IN (
            SELECT pr.id FROM public.protocol_recommendations pr
            JOIN public.diagnostic_analyses da ON pr.diagnostic_analysis_id = da.id
            WHERE da.practitioner_id = auth.uid()
        )
    );

CREATE POLICY "Admins read all reasoning" ON public.recommendation_reasoning
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- 10. TRIGGERS
-- ============================================

CREATE TRIGGER approved_frequency_names_updated_at BEFORE UPDATE ON public.approved_frequency_names
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER frequency_reference_images_updated_at BEFORE UPDATE ON public.frequency_reference_images
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER diagnostic_extracted_values_updated_at BEFORE UPDATE ON public.diagnostic_extracted_values
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 11. UPDATE USAGE EVENTS
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
        'protocol_outcome_recorded',
        -- New event types
        'diagnostic_extraction_completed',
        'frequency_image_uploaded',
        'frequency_names_extracted'
    ));

-- ============================================
-- SUCCESS
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'Migration complete: Protocol system overhaul with Sunday-first RAG, frequency validation, and explainability';
END $$;
