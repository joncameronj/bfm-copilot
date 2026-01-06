-- Force schema cache reload by creating a dummy table and dropping it
CREATE TABLE IF NOT EXISTS _schema_reload_trigger (id int);
DROP TABLE IF EXISTS _schema_reload_trigger;

-- Also try the NOTIFY
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- Log current state
DO $$
DECLARE
    cnt INT;
BEGIN
    SELECT COUNT(*) INTO cnt
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'smart_search_documents_v2' AND n.nspname = 'public';
    RAISE NOTICE 'FINAL: % smart_search_documents_v2 function(s) exist', cnt;
END $$;
