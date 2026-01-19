-- Add seminar_day filter to bfm_search_20250122
-- Enables Sunday-first cascading search strategy:
-- 1. Search Sunday docs first (tactical case studies, protocols)
-- 2. If insufficient results, add Saturday docs
-- 3. If still insufficient, add Friday docs

CREATE OR REPLACE FUNCTION public.bfm_search_20250122(
    p_query_embedding vector(1536),
    p_user_id UUID,
    p_care_categories TEXT[] DEFAULT NULL,
    p_body_systems TEXT[] DEFAULT NULL,
    p_document_categories TEXT[] DEFAULT NULL,
    p_tag_names TEXT[] DEFAULT NULL,
    p_include_related BOOLEAN DEFAULT TRUE,
    p_match_threshold DOUBLE PRECISION DEFAULT 0.40,
    p_match_count INTEGER DEFAULT 10,
    p_user_role TEXT DEFAULT 'member',
    p_seminar_day TEXT DEFAULT NULL  -- NEW: Filter by seminar day (friday, saturday, sunday)
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
    role_scope TEXT,
    case_study_id TEXT,
    seminar_day TEXT,  -- NEW: Include seminar_day in results
    similarity DOUBLE PRECISION,
    match_type TEXT,
    matched_tags TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        dc.id AS chunk_id,
        d.id AS document_id,
        dc.content,
        d.title,
        d.filename,
        d.care_category,
        d.body_system,
        d.document_category,
        d.role_scope,
        d.case_study_id,
        d.seminar_day,
        (1.0 - (dc.embedding <=> p_query_embedding))::double precision AS similarity,
        'semantic'::text AS match_type,
        ARRAY[]::text[] AS matched_tags
    FROM public.document_chunks dc
    JOIN public.documents d ON dc.document_id = d.id
    WHERE d.status IN ('completed', 'indexed')
      AND (d.user_id = p_user_id OR d.is_global = TRUE)
      AND (p_care_categories IS NULL OR d.care_category = ANY(p_care_categories))
      AND (p_body_systems IS NULL OR d.body_system = ANY(p_body_systems) OR d.body_system = 'multi_system')
      AND (p_document_categories IS NULL OR d.document_category = ANY(p_document_categories))
      AND (
          p_user_role IN ('practitioner', 'admin')
          OR d.document_category NOT IN ('protocol', 'frequency_reference')
      )
      -- NEW: Filter by seminar_day if specified
      AND (p_seminar_day IS NULL OR d.seminar_day = p_seminar_day)
      AND (1.0 - (dc.embedding <=> p_query_embedding)) > p_match_threshold
    ORDER BY (1.0 - (dc.embedding <=> p_query_embedding)) DESC
    LIMIT p_match_count;
$$;

-- Note: Comment on function skipped due to multiple function signatures
-- The p_seminar_day parameter enables Sunday-first cascading search

NOTIFY pgrst, 'reload schema';
