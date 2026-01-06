-- ============================================
-- NUCLEAR: Drop ALL smart_search_documents_v2 functions
-- ============================================

-- Drop using specific OID-based approach
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'smart_search_documents_v2'
        AND n.nspname = 'public'
    LOOP
        RAISE NOTICE 'Dropping function: %.%(%) ', r.nspname, r.proname, r.args;
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', r.nspname, r.proname, r.args);
    END LOOP;
END $$;

-- Verify all are dropped
DO $$
DECLARE
    func_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO func_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'smart_search_documents_v2'
    AND n.nspname = 'public';

    IF func_count > 0 THEN
        RAISE EXCEPTION 'Still have % functions named smart_search_documents_v2!', func_count;
    END IF;
    RAISE NOTICE 'All smart_search_documents_v2 functions dropped successfully';
END $$;

-- Now create FRESH function with NO ambiguity
CREATE FUNCTION public.smart_search_documents_v2(
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
    role_scope TEXT,
    case_study_id TEXT,
    similarity FLOAT,
    match_type TEXT,
    matched_tags TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_expanded_tags TEXT[];
    v_related_tags TEXT[];
BEGIN
    IF p_include_related AND p_tag_names IS NOT NULL THEN
        SELECT ARRAY_AGG(DISTINCT rc.related_tag)
        INTO v_related_tags
        FROM get_related_conditions(p_tag_names, 0.4) rc;
        v_expanded_tags := p_tag_names || COALESCE(v_related_tags, ARRAY[]::TEXT[]);
    ELSE
        v_expanded_tags := p_tag_names;
    END IF;

    RETURN QUERY
    WITH scored AS (
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
            (1 - (dc.embedding <=> p_query_embedding))::FLOAT AS sc_similarity,
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM public.document_tag_mappings dtm
                    JOIN public.document_tags dt ON dtm.tag_id = dt.id
                    WHERE dtm.document_id = d.id AND dt.tag_name = ANY(p_tag_names)
                ) THEN 'direct'::TEXT
                WHEN EXISTS (
                    SELECT 1 FROM public.document_tag_mappings dtm
                    JOIN public.document_tags dt ON dtm.tag_id = dt.id
                    WHERE dtm.document_id = d.id AND dt.tag_name = ANY(v_related_tags)
                ) THEN 'related'::TEXT
                ELSE 'semantic'::TEXT
            END AS sc_match_type,
            ARRAY(
                SELECT dt.tag_name
                FROM public.document_tag_mappings dtm
                JOIN public.document_tags dt ON dtm.tag_id = dt.id
                WHERE dtm.document_id = d.id AND dt.tag_name = ANY(v_expanded_tags)
            ) AS sc_matched_tags
        FROM public.document_chunks dc
        JOIN public.documents d ON dc.document_id = d.id
        WHERE d.status IN ('completed', 'indexed')
          AND (d.user_id = p_user_id OR d.is_global = TRUE)
          AND (p_care_categories IS NULL OR d.care_category = ANY(p_care_categories))
          AND (p_body_systems IS NULL OR d.body_system = ANY(p_body_systems))
          AND (p_document_categories IS NULL OR d.document_category = ANY(p_document_categories))
          AND (p_user_role IN ('practitioner', 'admin') OR d.document_category NOT IN ('protocol', 'frequency_reference'))
          AND (1 - (dc.embedding <=> p_query_embedding)) > p_match_threshold
    )
    SELECT
        s.sc_chunk_id,
        s.sc_document_id,
        s.sc_content,
        s.sc_title,
        s.sc_filename,
        s.sc_care_category,
        s.sc_body_system,
        s.sc_document_category,
        s.sc_role_scope,
        s.sc_case_study_id,
        s.sc_similarity,
        s.sc_match_type,
        s.sc_matched_tags
    FROM scored s
    ORDER BY
        CASE s.sc_match_type
            WHEN 'direct' THEN 1
            WHEN 'related' THEN 2
            ELSE 3
        END,
        s.sc_similarity DESC
    LIMIT p_match_count;
END;
$func$;

COMMENT ON FUNCTION public.smart_search_documents_v2 IS 'Nuclear rebuild - all columns prefixed to avoid any ambiguity';
