-- Migration: add_missing_frequency_aliases
-- Created: 2026-04-03
-- Description: Re-applies frequency aliases that were wiped by the reseed truncate in
--              20260124100000_reseed_all_frequencies.sql. The original alias UPDATEs in
--              20260123000001 ran before that TRUNCATE, so the aliases never survived.

BEGIN;

-- ============================================================
-- MAIN CHANGES
-- ============================================================

-- 'Pit P Support' alias for 'Pituitary P Supp'
-- Tests: frequency-validation.test.ts line 156
UPDATE approved_frequency_names
SET aliases = CASE
  WHEN 'Pit P Support' = ANY(COALESCE(aliases, '{}')) THEN aliases
  ELSE array_append(COALESCE(aliases, '{}'), 'Pit P Support')
END
WHERE name = 'Pituitary P Supp';

-- 'NS EMF' alias for 'EMF NS' (word-order variation used in case studies)
-- Tests: frequency-validation.test.ts line 168
UPDATE approved_frequency_names
SET aliases = CASE
  WHEN 'NS EMF' = ANY(COALESCE(aliases, '{}')) THEN aliases
  ELSE array_append(COALESCE(aliases, '{}'), 'NS EMF')
END
WHERE name = 'EMF NS';

COMMIT;

-- ROLLBACK (run manually if needed):
-- BEGIN;
-- UPDATE approved_frequency_names
--   SET aliases = array_remove(aliases, 'Pit P Support')
--   WHERE name = 'Pituitary P Supp';
-- UPDATE approved_frequency_names
--   SET aliases = array_remove(aliases, 'NS EMF')
--   WHERE name = 'EMF NS';
-- COMMIT;
