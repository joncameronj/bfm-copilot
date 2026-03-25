-- Add 'organ' to the protocol_recommendations category check constraint.
-- Layer 2 protocols use category='organ' and were silently rejected by the old constraint,
-- causing layer 2 frequencies to be missing from the UI.

ALTER TABLE public.protocol_recommendations
  DROP CONSTRAINT IF EXISTS protocol_recommendations_category_check;

ALTER TABLE public.protocol_recommendations
  ADD CONSTRAINT protocol_recommendations_category_check
  CHECK (category IN (
    'general', 'detox', 'hormone', 'gut', 'immune', 'metabolic', 'neurological', 'organ'
  ));
