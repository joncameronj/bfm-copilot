-- Lower similarity threshold from 0.45 to 0.40 to improve recall
-- Rationale: Exact word matches still failing at 0.45 threshold
-- Successful matches typically have similarity 0.54-0.58
-- Lower threshold captures more relevant results while still filtering noise

CREATE OR REPLACE FUNCTION public.bfm_search_20250122(
    p_query_embedding vector(1536),
    p_user_id UUID,
    p_care_categories TEXT[] DEFAULT NULL,
    p_body_systems TEXT[] DEFAULT NULL,
    p_document_categories TEXT[] DEFAULT NULL,
    p_tag_names TEXT[] DEFAULT NULL,
    p_include_related BOOLEAN DEFAULT TRUE,
    p_match_threshold DOUBLE PRECISION DEFAULT 0.40,  -- Lowered from 0.45
    p_match_count INTEGER DEFAULT 10,
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
    role_scope TEXT,
    case_study_id TEXT,
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
      AND (1.0 - (dc.embedding <=> p_query_embedding)) > p_match_threshold
    ORDER BY (1.0 - (dc.embedding <=> p_query_embedding)) DESC
    LIMIT p_match_count;
$$;

NOTIFY pgrst, 'reload schema';
