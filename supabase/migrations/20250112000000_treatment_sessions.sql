-- Migration: Treatment Sessions for FSM (Frequency Specific Microcurrent) logging

-- Create effect enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'treatment_effect') THEN
    CREATE TYPE treatment_effect AS ENUM ('positive', 'negative', 'nil');
  END IF;
END $$;

-- Create treatment_sessions table
CREATE TABLE IF NOT EXISTS treatment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  practitioner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  protocol_id uuid REFERENCES protocols(id) ON DELETE SET NULL,

  -- Session details
  session_date date NOT NULL,
  session_time time,

  -- Frequencies used (array of frequency objects with id, name, frequency_a, frequency_b)
  frequencies_used jsonb DEFAULT '[]'::jsonb,

  -- Outcome tracking
  effect treatment_effect NOT NULL,
  notes text,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_treatment_sessions_patient ON treatment_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_sessions_practitioner ON treatment_sessions(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_treatment_sessions_date ON treatment_sessions(session_date DESC);
CREATE INDEX IF NOT EXISTS idx_treatment_sessions_protocol ON treatment_sessions(protocol_id);

-- Enable RLS
ALTER TABLE treatment_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'treatment_sessions' AND policyname = 'Practitioners can view their own sessions') THEN
    CREATE POLICY "Practitioners can view their own sessions"
      ON treatment_sessions FOR SELECT
      USING (auth.uid() = practitioner_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'treatment_sessions' AND policyname = 'Practitioners can create sessions') THEN
    CREATE POLICY "Practitioners can create sessions"
      ON treatment_sessions FOR INSERT
      WITH CHECK (auth.uid() = practitioner_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'treatment_sessions' AND policyname = 'Practitioners can update their own sessions') THEN
    CREATE POLICY "Practitioners can update their own sessions"
      ON treatment_sessions FOR UPDATE
      USING (auth.uid() = practitioner_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'treatment_sessions' AND policyname = 'Practitioners can delete their own sessions') THEN
    CREATE POLICY "Practitioners can delete their own sessions"
      ON treatment_sessions FOR DELETE
      USING (auth.uid() = practitioner_id);
  END IF;
END $$;

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_treatment_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS treatment_sessions_updated_at ON treatment_sessions;
CREATE TRIGGER treatment_sessions_updated_at
  BEFORE UPDATE ON treatment_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_treatment_sessions_updated_at();
