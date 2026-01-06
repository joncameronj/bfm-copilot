-- Force PostgREST cache invalidation
-- This creates a new sequence trigger that forces reload

-- Send multiple NOTIFY signals
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload config');

-- Create and immediately drop a table to force metadata refresh
CREATE TABLE IF NOT EXISTS _cache_buster_temp_12345 (id serial);
DROP TABLE IF EXISTS _cache_buster_temp_12345;

-- Verify function is SQL not plpgsql
DO $$
DECLARE
    func_lang TEXT;
    func_src TEXT;
BEGIN
    SELECT l.lanname, prosrc INTO func_lang, func_src
    FROM pg_proc p
    JOIN pg_language l ON p.prolang = l.oid
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'smart_search_documents_v2' AND n.nspname = 'public';

    RAISE NOTICE 'Function language: %', func_lang;
    RAISE NOTICE 'Function source preview: %', substring(func_src, 1, 200);

    IF func_lang = 'plpgsql' THEN
        RAISE EXCEPTION 'FUNCTION IS STILL PLPGSQL! Cache not updated.';
    END IF;
END $$;

-- Send more NOTIFY
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
