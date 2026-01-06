-- Drop the OLD V1 signature that's still lingering
-- V1 has p_user_role as 3rd param and only 9 params total
DROP FUNCTION IF EXISTS public.smart_search_documents_v2(
    vector,              -- p_query_embedding
    uuid,                -- p_user_id
    text,                -- p_user_role (3rd in V1)
    text[],              -- p_tag_names (4th in V1)
    text[],              -- p_body_systems (5th in V1)
    text[],              -- p_document_categories (6th in V1)
    boolean,             -- p_include_related (7th in V1)
    double precision,    -- p_match_threshold (8th in V1)
    integer              -- p_match_count (9th in V1)
) CASCADE;

-- Also drop with vector(1536) explicitly
DROP FUNCTION IF EXISTS public.smart_search_documents_v2(
    vector(1536),
    uuid,
    text,
    text[],
    text[],
    text[],
    boolean,
    double precision,
    integer
) CASCADE;

-- Verify count
DO $$
DECLARE
    cnt INT;
    func_names TEXT;
BEGIN
    SELECT COUNT(*), string_agg(pg_get_function_identity_arguments(p.oid), ' | ')
    INTO cnt, func_names
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'smart_search_documents_v2' AND n.nspname = 'public';

    RAISE NOTICE 'After V1 drop: % functions remaining. Signatures: %', cnt, func_names;
END $$;

NOTIFY pgrst, 'reload schema';
