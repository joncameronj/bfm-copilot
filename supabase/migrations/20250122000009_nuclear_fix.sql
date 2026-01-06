-- ============================================
-- NUCLEAR FIX: Use pg_proc to find and drop ALL versions
-- ============================================

-- First, list and drop ALL functions named smart_search_documents_v2
DO $$
DECLARE
    func_oid OID;
    func_sig TEXT;
    drop_cmd TEXT;
BEGIN
    FOR func_oid, func_sig IN
        SELECT p.oid, pg_get_function_identity_arguments(p.oid)
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'smart_search_documents_v2' AND n.nspname = 'public'
    LOOP
        RAISE NOTICE 'Dropping function with signature: %', func_sig;
        drop_cmd := format('DROP FUNCTION IF EXISTS public.smart_search_documents_v2(%s) CASCADE', func_sig);
        EXECUTE drop_cmd;
    END LOOP;
END $$;

-- Verify nothing remains
DO $$
DECLARE
    cnt INT;
BEGIN
    SELECT COUNT(*) INTO cnt
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'smart_search_documents_v2' AND n.nspname = 'public';

    IF cnt > 0 THEN
        RAISE EXCEPTION 'FAILED TO DROP ALL FUNCTIONS! % remaining', cnt;
    END IF;
    RAISE NOTICE 'SUCCESS: All smart_search_documents_v2 functions dropped';
END $$;

-- Create clean version using SIMPLE SQL (not plpgsql) to avoid variable/column ambiguity
CREATE OR REPLACE FUNCTION public.smart_search_documents_v2(
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
      AND (p_body_systems IS NULL OR d.body_system = ANY(p_body_systems))
      AND (p_document_categories IS NULL OR d.document_category = ANY(p_document_categories))
      AND (
          p_user_role IN ('practitioner', 'admin')
          OR d.document_category NOT IN ('protocol', 'frequency_reference')
      )
      AND (1.0 - (dc.embedding <=> p_query_embedding)) > p_match_threshold
    ORDER BY (1.0 - (dc.embedding <=> p_query_embedding)) DESC
    LIMIT p_match_count;
$$;

-- Verify exactly 1 function exists
DO $$
DECLARE
    cnt INT;
    sig TEXT;
BEGIN
    SELECT COUNT(*), string_agg(pg_get_function_identity_arguments(p.oid), ' | ')
    INTO cnt, sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'smart_search_documents_v2' AND n.nspname = 'public';

    RAISE NOTICE 'Final state: % function(s). Signature(s): %', cnt, sig;
END $$;

NOTIFY pgrst, 'reload schema';
