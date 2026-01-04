-- Add patient_consult to conversation_type CHECK constraint

-- Drop the existing constraint
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_conversation_type_check;

-- Add the new constraint with patient_consult
ALTER TABLE public.conversations
ADD CONSTRAINT conversations_conversation_type_check
CHECK (conversation_type IN ('general', 'lab_analysis', 'diagnostics', 'brainstorm', 'patient_consult'));
