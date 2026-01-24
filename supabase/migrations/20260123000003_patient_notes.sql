-- Create patient_notes table
CREATE TABLE public.patient_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.patient_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own patient notes
CREATE POLICY "Users manage own patient notes" ON public.patient_notes
    FOR ALL USING (user_id = auth.uid());

-- Index for fast lookups by patient_id
CREATE INDEX idx_patient_notes_patient_id ON public.patient_notes(patient_id);

-- Index for fast lookups by user_id
CREATE INDEX idx_patient_notes_user_id ON public.patient_notes(user_id);

-- Trigger to update updated_at on changes
CREATE OR REPLACE FUNCTION update_patient_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patient_notes_updated_at
    BEFORE UPDATE ON public.patient_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_patient_notes_updated_at();
