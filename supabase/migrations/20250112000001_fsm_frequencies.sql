-- Migration: FSM (Frequency Specific Microcurrent) Frequencies Table

-- Create fsm_frequencies table
CREATE TABLE IF NOT EXISTS fsm_frequencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  frequency_a numeric NOT NULL,  -- Channel A frequency (Hz)
  frequency_b numeric,           -- Channel B frequency (Hz) - optional
  category text,                 -- e.g., 'diabetes', 'thyroid', 'inflammation', 'nerve', 'muscle'
  condition text,                -- Target condition/symptom
  description text,
  source text,                   -- Reference source document
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fsm_frequencies_category ON fsm_frequencies(category);
CREATE INDEX IF NOT EXISTS idx_fsm_frequencies_condition ON fsm_frequencies(condition);
CREATE INDEX IF NOT EXISTS idx_fsm_frequencies_active ON fsm_frequencies(is_active);

-- Enable RLS
ALTER TABLE fsm_frequencies ENABLE ROW LEVEL SECURITY;

-- RLS Policies - frequencies are readable by all authenticated users
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fsm_frequencies' AND policyname = 'Authenticated users can view frequencies') THEN
    CREATE POLICY "Authenticated users can view frequencies"
      ON fsm_frequencies FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  -- Only admins can modify frequencies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fsm_frequencies' AND policyname = 'Admins can manage frequencies') THEN
    CREATE POLICY "Admins can manage frequencies"
      ON fsm_frequencies FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_fsm_frequencies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fsm_frequencies_updated_at ON fsm_frequencies;
CREATE TRIGGER fsm_frequencies_updated_at
  BEFORE UPDATE ON fsm_frequencies
  FOR EACH ROW
  EXECUTE FUNCTION update_fsm_frequencies_updated_at();

-- Seed with some common FSM frequencies (placeholder - will be populated from RAG PDFs)
-- These are example frequencies based on common FSM protocols
INSERT INTO fsm_frequencies (name, frequency_a, frequency_b, category, condition, description, source) VALUES
  ('Inflammation Reduction', 40, 116, 'inflammation', 'General inflammation', 'Reduces inflammation and promotes healing', 'FSM Core Protocols'),
  ('Nerve Pain Relief', 40, 396, 'nerve', 'Neuropathy', 'Targets nerve tissue for pain relief', 'FSM Core Protocols'),
  ('Muscle Relaxation', 40, 62, 'muscle', 'Muscle spasm', 'Relaxes muscle tissue and reduces spasms', 'FSM Core Protocols'),
  ('Scar Tissue', 13, 77, 'tissue', 'Scarring', 'Softens and reduces scar tissue', 'FSM Core Protocols'),
  ('Liver Support', 40, 27, 'organ', 'Liver dysfunction', 'Supports liver function and detoxification', 'FSM Core Protocols'),
  ('Kidney Support', 40, 32, 'organ', 'Kidney dysfunction', 'Supports kidney function', 'FSM Core Protocols'),
  ('Adrenal Support', 40, 34, 'endocrine', 'Adrenal fatigue', 'Supports adrenal gland function', 'FSM Core Protocols'),
  ('Thyroid Support', 40, 36, 'endocrine', 'Thyroid dysfunction', 'Supports thyroid gland function', 'thyroid-frequencies.pdf'),
  ('Pancreas Support', 40, 37, 'endocrine', 'Pancreatic dysfunction', 'Supports pancreatic function', 'diabetes-frequencies.pdf'),
  ('Concussion Recovery', 40, 89, 'neurological', 'Concussion', 'Supports brain tissue healing post-concussion', 'FSM Core Protocols')
ON CONFLICT DO NOTHING;
