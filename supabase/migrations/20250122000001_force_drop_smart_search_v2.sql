-- ============================================
-- FORCE Drop ALL smart_search_documents_v2 overloads by name
-- ============================================
-- Previous DROP statements may have failed due to signature mismatch.
-- This uses CASCADE and a different approach to drop ALL versions.

-- First, try dropping by specific known signatures
DROP FUNCTION IF EXISTS public.smart_search_documents_v2(vector, uuid, text, text[], text[], text[], boolean, double precision, integer) CASCADE;
DROP FUNCTION IF EXISTS public.smart_search_documents_v2(vector, uuid, text[], text[], text[], text[], boolean, double precision, integer, text) CASCADE;

-- Also try with float instead of double precision
DROP FUNCTION IF EXISTS public.smart_search_documents_v2(vector, uuid, text, text[], text[], text[], boolean, real, integer) CASCADE;
DROP FUNCTION IF EXISTS public.smart_search_documents_v2(vector, uuid, text[], text[], text[], text[], boolean, real, integer, text) CASCADE;

-- Try generic drops for any remaining overloads
DO $$
DECLARE
    func_oid oid;
BEGIN
    -- Find and drop all functions named smart_search_documents_v2
    FOR func_oid IN
        SELECT p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'smart_search_documents_v2'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_oid::regprocedure || ' CASCADE';
    END LOOP;
END $$;

-- Now create the single correct version
CREATE FUNCTION smart_search_documents_v2(
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
            d.id AS document_id,
            dc.content,
            d.title,
            d.filename,
            d.care_category,
            d.body_system,
            d.document_category,
            d.role_scope,
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
            END AS chunk_match_type,
            ARRAY(
                SELECT dt.tag_name
                FROM public.document_tag_mappings dtm
                JOIN public.document_tags dt ON dtm.tag_id = dt.id
                WHERE dtm.document_id = d.id AND dt.tag_name = ANY(v_expanded_tags)
            ) AS matched_tags
        FROM public.document_chunks dc
        JOIN public.documents d ON dc.document_id = d.id
        WHERE d.status IN ('completed', 'indexed')
          AND (d.user_id = p_user_id OR d.is_global = TRUE)
          AND (p_care_categories IS NULL OR d.care_category = ANY(p_care_categories))
          AND (p_body_systems IS NULL OR d.body_system = ANY(p_body_systems))
          AND (p_document_categories IS NULL OR d.document_category = ANY(p_document_categories))
          AND (
              p_user_role IN ('practitioner', 'admin')
              OR d.document_category NOT IN ('protocol', 'frequency_reference')
          )
          AND 1 - (dc.embedding <=> p_query_embedding) > p_match_threshold
    )
    SELECT
        sc.chunk_id,
        sc.document_id,
        sc.content,
        sc.title,
        sc.filename,
        sc.care_category,
        sc.body_system,
        sc.document_category,
        sc.role_scope,
        sc.case_study_id,
        sc.similarity,
        sc.chunk_match_type AS match_type,
        sc.matched_tags
    FROM scored_chunks sc
    ORDER BY
        CASE sc.chunk_match_type
            WHEN 'direct' THEN 1
            WHEN 'related' THEN 2
            ELSE 3
        END,
        sc.similarity DESC
    LIMIT p_match_count;
END;
$$;

COMMENT ON FUNCTION smart_search_documents_v2 IS 'Smart vector search - all previous overloads force dropped';
