-- Backfill seminar_day for existing documents based on filename/title patterns
-- This enables Sunday-first RAG search to find tactical case study content

-- Backfill seminar_day based on filename and title patterns
UPDATE public.documents
SET seminar_day =
  CASE
    WHEN LOWER(filename) LIKE '%sun %' OR LOWER(filename) LIKE '%sun.%'
      OR LOWER(filename) LIKE '%sunday%' OR LOWER(title) LIKE '%sunday%' THEN 'sunday'
    WHEN LOWER(filename) LIKE '%sat %' OR LOWER(filename) LIKE '%sat.%'
      OR LOWER(filename) LIKE '%saturday%' OR LOWER(title) LIKE '%saturday%' THEN 'saturday'
    WHEN LOWER(filename) LIKE '%fri %' OR LOWER(filename) LIKE '%fri.%'
      OR LOWER(filename) LIKE '%friday%' OR LOWER(title) LIKE '%friday%' THEN 'friday'
    ELSE seminar_day
  END
WHERE seminar_day IS NULL;

-- Log results
DO $$
DECLARE
  sunday_count INT;
  saturday_count INT;
  friday_count INT;
  null_count INT;
BEGIN
  SELECT COUNT(*) INTO sunday_count FROM documents WHERE seminar_day = 'sunday';
  SELECT COUNT(*) INTO saturday_count FROM documents WHERE seminar_day = 'saturday';
  SELECT COUNT(*) INTO friday_count FROM documents WHERE seminar_day = 'friday';
  SELECT COUNT(*) INTO null_count FROM documents WHERE seminar_day IS NULL;
  RAISE NOTICE 'Backfill complete: Sunday=%, Saturday=%, Friday=%, NULL=%',
    sunday_count, saturday_count, friday_count, null_count;
END $$;

NOTIFY pgrst, 'reload schema';
