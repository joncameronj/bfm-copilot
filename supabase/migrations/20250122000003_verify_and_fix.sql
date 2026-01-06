-- ============================================
-- Verify and fix smart_search_documents_v2
-- ============================================

-- First, check if we can get function info
DO $$
DECLARE
    func_count INTEGER;
    func_src TEXT;
BEGIN
    SELECT COUNT(*), string_agg(prosrc, '---') INTO func_count, func_src
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'smart_search_documents_v2' AND n.nspname = 'public';

    RAISE NOTICE 'Found % function(s)', func_count;

    IF func_src LIKE '%CASE match_type%' OR func_src LIKE '%ORDER BY%match_type%' THEN
        RAISE NOTICE 'BUG DETECTED: Function still has unqualified match_type reference';
    ELSIF func_src LIKE '%sc_match_type%' THEN
        RAISE NOTICE 'GOOD: Function uses sc_match_type prefix';
    ELSE
        RAISE NOTICE 'Function source snippet: %', substring(func_src, 1, 500);
    END IF;
END $$;

-- Force drop ALL versions
DROP FUNCTION IF EXISTS public.smart_search_documents_v2(vector, uuid, text[], text[], text[], text[], boolean, double precision, integer, text) CASCADE;

-- Create minimal working version
CREATE OR REPLACE FUNCTION public.smart_search_documents_v2(
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
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT
        dc.id,
        d.id,
        dc.content,
        d.title,
        d.filename,
        d.care_category,
        d.body_system,
        d.document_category,
        d.role_scope,
        d.case_study_id,
        (1 - (dc.embedding <=> p_query_embedding))::FLOAT,
        'semantic'::TEXT,
        ARRAY[]::TEXT[]
    FROM public.document_chunks dc
    JOIN public.documents d ON dc.document_id = d.id
    WHERE d.status IN ('completed', 'indexed')
      AND (d.user_id = p_user_id OR d.is_global = TRUE)
      AND (1 - (dc.embedding <=> p_query_embedding)) > p_match_threshold
    ORDER BY (1 - (dc.embedding <=> p_query_embedding)) DESC
    LIMIT p_match_count;
$$;

-- Notify schema cache to reload
NOTIFY pgrst, 'reload schema';
