-- Remove 'other' from patients.gender constraint (only male/female)

-- Update any existing 'other' rows to 'female' as fallback
UPDATE public.patients SET gender = 'female' WHERE gender = 'other';

-- Drop old constraint and add new one
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_gender_check;
ALTER TABLE public.patients ADD CONSTRAINT patients_gender_check CHECK (gender IN ('male', 'female'));
