-- ===========================================
-- ADD FREQUENCY ALIASES FOR DIAGNOSTIC ANALYSIS
-- ===========================================
-- This migration adds aliases for naming variations found in case studies
-- to ensure frequency recommendations match properly.
-- ===========================================

-- Add aliases for naming variations
-- "Pit P Support" -> "Pituitary P Supp"
UPDATE approved_frequency_names
SET aliases = array_append(COALESCE(aliases, '{}'), 'Pit P Support')
WHERE name = 'Pituitary P Supp'
  AND NOT ('Pit P Support' = ANY(COALESCE(aliases, '{}')));

-- "NS EMF" -> "EMF NS" (word order variation)
UPDATE approved_frequency_names
SET aliases = array_append(COALESCE(aliases, '{}'), 'NS EMF')
WHERE name = 'EMF NS'
  AND NOT ('NS EMF' = ANY(COALESCE(aliases, '{}')));

-- Add missing frequency: Kidney Support
INSERT INTO approved_frequency_names (name, category, description)
VALUES ('Kidney Support', 'general', 'Kidney support protocol for renal function optimization')
ON CONFLICT (name) DO NOTHING;

-- Note: "Medula Support" will fuzzy-match to "Medulla Support" (Levenshtein distance = 1)
-- so no alias needed for that variation.
