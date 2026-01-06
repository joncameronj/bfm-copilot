-- ===========================================
-- FIX INSULIN RESISTANCE PROTOCOL NAME TYPO
-- ===========================================
-- Changes 'Insulin Resis#1' to 'Insulin Resistance 1'
-- ===========================================

-- Update the approved_frequency_names table
UPDATE public.approved_frequency_names
SET name = 'Insulin Resistance 1',
    updated_at = NOW()
WHERE name = 'Insulin Resis#1';

-- Verification
DO $$
DECLARE
  v_old_count INTEGER;
  v_new_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_old_count FROM public.approved_frequency_names WHERE name = 'Insulin Resis#1';
  SELECT COUNT(*) INTO v_new_count FROM public.approved_frequency_names WHERE name = 'Insulin Resistance 1';

  IF v_old_count > 0 THEN
    RAISE WARNING 'Old name "Insulin Resis#1" still exists: % records', v_old_count;
  END IF;

  RAISE NOTICE 'Protocol name update complete. "Insulin Resistance 1" count: %', v_new_count;
END $$;
