-- BRUTE FORCE: Drop all possible function signatures
DROP FUNCTION IF EXISTS public.smart_search_documents_v2 CASCADE;

-- Try all common type variations
DROP FUNCTION IF EXISTS public.smart_search_documents_v2(vector, uuid, text, text[], text[], text[], boolean, double precision, integer) CASCADE;
DROP FUNCTION IF EXISTS public.smart_search_documents_v2(vector, uuid, text[], text[], text[], text[], boolean, double precision, integer, text) CASCADE;
DROP FUNCTION IF EXISTS public.smart_search_documents_v2(vector, uuid, text, text[], text[], text[], bool, float8, int4) CASCADE;
DROP FUNCTION IF EXISTS public.smart_search_documents_v2(vector, uuid, text[], text[], text[], text[], bool, float8, int4, text) CASCADE;

-- Re-verify nothing remains
DO $$
DECLARE
    cnt INT;
BEGIN
    SELECT COUNT(*) INTO cnt FROM pg_proc WHERE proname = 'smart_search_documents_v2';
    IF cnt > 0 THEN
        RAISE EXCEPTION 'STILL HAVE % FUNCTIONS!', cnt;
    END IF;
    RAISE NOTICE 'All smart_search_documents_v2 functions dropped';
END $$;

-- Create simple working version
CREATE FUNCTION public.smart_search_documents_v2(
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
LANGUAGE sql
STABLE
SECURITY DEFINER
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
      AND (1.0 - (dc.embedding <=> p_query_embedding)) > p_match_threshold
    ORDER BY (1.0 - (dc.embedding <=> p_query_embedding)) DESC
    LIMIT p_match_count
$$;

NOTIFY pgrst, 'reload schema';
