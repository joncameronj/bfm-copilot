-- ============================================
-- Create smart_search_documents_v3 - Clean function to bypass PostgREST cache
-- ============================================
-- The v2 function has multiple cached overloads in PostgREST that cannot be resolved.
-- Creating a new function with a fresh name bypasses all caching issues.

CREATE OR REPLACE FUNCTION public.smart_search_documents_v3(
    p_query_embedding vector(1536),
    p_user_id UUID,
    p_care_categories TEXT[] DEFAULT NULL,
    p_body_systems TEXT[] DEFAULT NULL,
    p_document_categories TEXT[] DEFAULT NULL,
    p_tag_names TEXT[] DEFAULT NULL,
    p_include_related BOOLEAN DEFAULT TRUE,
    p_match_threshold DOUBLE PRECISION DEFAULT 0.6,
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_expanded_tags TEXT[];
    v_related_tags TEXT[];
BEGIN
    -- Expand tags to include related conditions if requested
    IF p_include_related AND p_tag_names IS NOT NULL AND array_length(p_tag_names, 1) > 0 THEN
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
            dc.id AS sc_chunk_id,
            d.id AS sc_document_id,
            dc.content AS sc_content,
            d.title AS sc_title,
            d.filename AS sc_filename,
            d.care_category AS sc_care_category,
            d.body_system AS sc_body_system,
            d.document_category AS sc_document_category,
            d.role_scope AS sc_role_scope,
            d.case_study_id AS sc_case_study_id,
            (1.0 - (dc.embedding <=> p_query_embedding))::double precision AS sc_similarity,
            CASE
                WHEN v_expanded_tags IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.document_tag_mappings dtm
                    JOIN public.document_tags dt ON dtm.tag_id = dt.id
                    WHERE dtm.document_id = d.id AND dt.tag_name = ANY(p_tag_names)
                ) THEN 'direct'::text
                WHEN v_related_tags IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.document_tag_mappings dtm
                    JOIN public.document_tags dt ON dtm.tag_id = dt.id
                    WHERE dtm.document_id = d.id AND dt.tag_name = ANY(v_related_tags)
                ) THEN 'related'::text
                ELSE 'semantic'::text
            END AS sc_match_type,
            COALESCE(
                ARRAY(
                    SELECT dt.tag_name
                    FROM public.document_tag_mappings dtm
                    JOIN public.document_tags dt ON dtm.tag_id = dt.id
                    WHERE dtm.document_id = d.id
                      AND v_expanded_tags IS NOT NULL
                      AND dt.tag_name = ANY(v_expanded_tags)
                ),
                ARRAY[]::text[]
            ) AS sc_matched_tags
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
          AND (1.0 - (dc.embedding <=> p_query_embedding)) > p_match_threshold
    )
    SELECT
        sc.sc_chunk_id AS chunk_id,
        sc.sc_document_id AS document_id,
        sc.sc_content AS content,
        sc.sc_title AS title,
        sc.sc_filename AS filename,
        sc.sc_care_category AS care_category,
        sc.sc_body_system AS body_system,
        sc.sc_document_category AS document_category,
        sc.sc_role_scope AS role_scope,
        sc.sc_case_study_id AS case_study_id,
        sc.sc_similarity AS similarity,
        sc.sc_match_type AS match_type,
        sc.sc_matched_tags AS matched_tags
    FROM scored_chunks sc
    ORDER BY
        CASE sc.sc_match_type
            WHEN 'direct' THEN 1
            WHEN 'related' THEN 2
            ELSE 3
        END,
        sc.sc_similarity DESC
    LIMIT p_match_count;
END;
$$;

COMMENT ON FUNCTION public.smart_search_documents_v3(vector(1536), UUID, TEXT[], TEXT[], TEXT[], TEXT[], BOOLEAN, DOUBLE PRECISION, INTEGER, TEXT)
IS 'Smart vector search v3 - clean implementation with care_category filter and role-based content access. Replaces v2 to bypass PostgREST cache issues.';

-- Force schema reload
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
