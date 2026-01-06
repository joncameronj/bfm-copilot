-- ============================================
-- Drop ALL smart_search_documents_v2 overloads
-- ============================================
-- Multiple overloaded versions exist with different signatures.
-- We must drop ALL of them before creating the correct version.

-- Drop 9-parameter version from 20250104000000_role_scope.sql
-- Signature: (vector, UUID, TEXT, TEXT[], TEXT[], TEXT[], BOOLEAN, FLOAT, INT)
DROP FUNCTION IF EXISTS smart_search_documents_v2(
    vector(1536),
    UUID,
    TEXT,        -- p_user_role in 3rd position
    TEXT[],      -- p_tag_names
    TEXT[],      -- p_body_systems
    TEXT[],      -- p_document_categories
    BOOLEAN,     -- p_include_related
    FLOAT,       -- p_match_threshold
    INT          -- p_match_count
);

-- Drop 10-parameter version from 20250106000000/20250121000000
-- Signature: (vector, UUID, TEXT[], TEXT[], TEXT[], TEXT[], BOOLEAN, FLOAT, INT, TEXT)
DROP FUNCTION IF EXISTS smart_search_documents_v2(
    vector(1536),
    UUID,
    TEXT[],      -- p_care_categories in 3rd position
    TEXT[],      -- p_body_systems
    TEXT[],      -- p_document_categories
    TEXT[],      -- p_tag_names
    BOOLEAN,     -- p_include_related
    FLOAT,       -- p_match_threshold
    INT,         -- p_match_count
    TEXT         -- p_user_role in 10th position
);

-- Create the correct version (10-parameter signature with fixed match_type handling)
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
            END AS chunk_match_type,  -- Named differently to avoid ambiguity
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
        sc.chunk_match_type AS match_type,  -- Alias to match RETURNS TABLE
        sc.matched_tags
    FROM scored_chunks sc
    ORDER BY
        CASE sc.chunk_match_type  -- Use qualified column name
            WHEN 'direct' THEN 1
            WHEN 'related' THEN 2
            ELSE 3
        END,
        sc.similarity DESC
    LIMIT p_match_count;
END;
$$;

COMMENT ON FUNCTION smart_search_documents_v2(vector(1536), UUID, TEXT[], TEXT[], TEXT[], TEXT[], BOOLEAN, FLOAT, INT, TEXT)
IS 'Smart vector search with care_category filter, role-based content access, and fixed match_type ambiguity. All previous overloads dropped.';
