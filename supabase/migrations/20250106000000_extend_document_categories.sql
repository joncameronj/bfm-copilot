-- Migration: Extend Document Categories for RAG Ingestion
-- Adds new document categories for BFM asset ingestion:
-- - seminar_transcript: BFM conference seminar transcripts
-- - hrv_assessment: HRV test results and assessments
-- - frequency_reference: Frequency protocol documents
-- - image_extraction: Content extracted from images via Vision API

-- ============================================
-- Update document_category constraint
-- ============================================

-- Drop existing constraint
ALTER TABLE public.documents
    DROP CONSTRAINT IF EXISTS check_document_category;

-- Add updated constraint with new categories
ALTER TABLE public.documents
    ADD CONSTRAINT check_document_category CHECK (
        document_category IS NULL OR document_category IN (
            -- Original categories
            'protocol',
            'lab_guide',
            'care_guide',
            'reference',
            'patient_education',
            'case_study',
            -- New categories for ingestion
            'seminar_transcript',
            'hrv_assessment',
            'frequency_reference',
            'image_extraction',
            'other'
        )
    );

-- ============================================
-- Add care_category column for BFM conditions
-- ============================================

-- Add care_category column if not exists
ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS care_category TEXT;

-- Add constraint for care categories
ALTER TABLE public.documents
    ADD CONSTRAINT check_care_category CHECK (
        care_category IS NULL OR care_category IN (
            'diabetes',
            'thyroid',
            'hormones',
            'neurological',
            'general'
        )
    );

-- Index for care_category
CREATE INDEX IF NOT EXISTS idx_documents_care_category
    ON public.documents(care_category);

-- ============================================
-- Add case_study_id column for linking assets
-- ============================================

ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS case_study_id TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_case_study
    ON public.documents(case_study_id);

-- ============================================
-- Update smart_search to support care_category
-- ============================================

-- Create or replace the smart search function with care_category filter
CREATE OR REPLACE FUNCTION smart_search_documents_v2(
    p_query_embedding vector(1536),
    p_user_id UUID,
    p_care_categories TEXT[] DEFAULT NULL,
    p_body_systems TEXT[] DEFAULT NULL,
    p_document_categories TEXT[] DEFAULT NULL,
    p_tag_names TEXT[] DEFAULT NULL,
    p_include_related BOOLEAN DEFAULT TRUE,
    p_match_threshold FLOAT DEFAULT 0.6,
    p_match_count INT DEFAULT 10,
    p_user_role TEXT DEFAULT 'member'
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    content TEXT,
    title TEXT,
    filename TEXT,
    care_category TEXT,
    body_system TEXT,
    document_category TEXT,
    case_study_id TEXT,
    similarity FLOAT,
    match_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_expanded_tags TEXT[];
    v_related_tags TEXT[];
BEGIN
    -- Expand tags to include related conditions if requested
    IF p_include_related AND p_tag_names IS NOT NULL THEN
        SELECT ARRAY_AGG(DISTINCT rc.related_tag)
        INTO v_related_tags
        FROM get_related_conditions(p_tag_names, 0.4) rc;

        v_expanded_tags := p_tag_names || COALESCE(v_related_tags, ARRAY[]::TEXT[]);
    ELSE
        v_expanded_tags := p_tag_names;
    END IF;

    RETURN QUERY
    WITH scored_chunks AS (
        SELECT
            dc.id AS chunk_id,
            dc.document_id,
            dc.content,
            d.title,
            d.filename,
            d.care_category,
            d.body_system,
            d.document_category,
            d.case_study_id,
            1 - (dc.embedding <=> p_query_embedding) AS similarity,
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM public.document_tag_mappings dtm
                    JOIN public.document_tags dt ON dtm.tag_id = dt.id
                    WHERE dtm.document_id = d.id AND dt.tag_name = ANY(p_tag_names)
                ) THEN 'direct'
                WHEN EXISTS (
                    SELECT 1 FROM public.document_tag_mappings dtm
                    JOIN public.document_tags dt ON dtm.tag_id = dt.id
                    WHERE dtm.document_id = d.id AND dt.tag_name = ANY(v_related_tags)
                ) THEN 'related'
                ELSE 'semantic'
            END AS match_type
        FROM public.document_chunks dc
        JOIN public.documents d ON dc.document_id = d.id
        WHERE d.status IN ('completed', 'indexed')
          AND (d.user_id = p_user_id OR d.is_global = TRUE)
          -- Care category filter
          AND (p_care_categories IS NULL OR d.care_category = ANY(p_care_categories))
          -- Body system filter
          AND (p_body_systems IS NULL OR d.body_system = ANY(p_body_systems))
          -- Document category filter
          AND (p_document_categories IS NULL OR d.document_category = ANY(p_document_categories))
          -- Role-based content filtering
          AND (
              p_user_role IN ('practitioner', 'admin')
              OR d.document_category NOT IN ('protocol', 'frequency_reference')
          )
          -- Similarity threshold
          AND 1 - (dc.embedding <=> p_query_embedding) > p_match_threshold
    )
    SELECT * FROM scored_chunks
    ORDER BY
        CASE match_type
            WHEN 'direct' THEN 1
            WHEN 'related' THEN 2
            ELSE 3
        END,
        similarity DESC
    LIMIT p_match_count;
END;
$$;

-- ============================================
-- Comments
-- ============================================
COMMENT ON COLUMN public.documents.care_category IS 'BFM care category: diabetes, thyroid, hormones, neurological';
COMMENT ON COLUMN public.documents.case_study_id IS 'Links assets belonging to the same case study (e.g., diabetes-cs1)';
COMMENT ON FUNCTION smart_search_documents_v2(vector(1536), UUID, TEXT[], TEXT[], TEXT[], TEXT[], BOOLEAN, FLOAT, INT, TEXT) IS 'Smart vector search with care_category filter and role-based content access';
