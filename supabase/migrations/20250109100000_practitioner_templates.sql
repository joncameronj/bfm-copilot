-- Migration: Add practitioner practice info and templates

-- Add practice info fields to profiles (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'profiles' AND column_name = 'practice_name') THEN
    ALTER TABLE profiles ADD COLUMN practice_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'profiles' AND column_name = 'specialty') THEN
    ALTER TABLE profiles ADD COLUMN specialty text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'profiles' AND column_name = 'phone') THEN
    ALTER TABLE profiles ADD COLUMN phone text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'profiles' AND column_name = 'address') THEN
    ALTER TABLE profiles ADD COLUMN address text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'profiles' AND column_name = 'website') THEN
    ALTER TABLE profiles ADD COLUMN website text;
  END IF;
END $$;

-- Create protocol_templates table
CREATE TABLE IF NOT EXISTS protocol_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create feedback_templates table
CREATE TABLE IF NOT EXISTS feedback_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'positive', -- positive, negative, neutral, partial
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_protocol_templates_practitioner ON protocol_templates(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_feedback_templates_practitioner ON feedback_templates(practitioner_id);

-- Enable RLS
ALTER TABLE protocol_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for protocol_templates
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'protocol_templates' AND policyname = 'Practitioners can view their own templates') THEN
    CREATE POLICY "Practitioners can view their own templates"
      ON protocol_templates FOR SELECT
      USING (auth.uid() = practitioner_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'protocol_templates' AND policyname = 'Practitioners can create their own templates') THEN
    CREATE POLICY "Practitioners can create their own templates"
      ON protocol_templates FOR INSERT
      WITH CHECK (auth.uid() = practitioner_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'protocol_templates' AND policyname = 'Practitioners can update their own templates') THEN
    CREATE POLICY "Practitioners can update their own templates"
      ON protocol_templates FOR UPDATE
      USING (auth.uid() = practitioner_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'protocol_templates' AND policyname = 'Practitioners can delete their own templates') THEN
    CREATE POLICY "Practitioners can delete their own templates"
      ON protocol_templates FOR DELETE
      USING (auth.uid() = practitioner_id);
  END IF;
END $$;

-- RLS Policies for feedback_templates
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback_templates' AND policyname = 'Practitioners can view their own feedback templates') THEN
    CREATE POLICY "Practitioners can view their own feedback templates"
      ON feedback_templates FOR SELECT
      USING (auth.uid() = practitioner_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback_templates' AND policyname = 'Practitioners can create their own feedback templates') THEN
    CREATE POLICY "Practitioners can create their own feedback templates"
      ON feedback_templates FOR INSERT
      WITH CHECK (auth.uid() = practitioner_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback_templates' AND policyname = 'Practitioners can update their own feedback templates') THEN
    CREATE POLICY "Practitioners can update their own feedback templates"
      ON feedback_templates FOR UPDATE
      USING (auth.uid() = practitioner_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback_templates' AND policyname = 'Practitioners can delete their own feedback templates') THEN
    CREATE POLICY "Practitioners can delete their own feedback templates"
      ON feedback_templates FOR DELETE
      USING (auth.uid() = practitioner_id);
  END IF;
END $$;

-- Updated at trigger for protocol_templates
CREATE OR REPLACE FUNCTION update_protocol_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protocol_templates_updated_at ON protocol_templates;
CREATE TRIGGER protocol_templates_updated_at
  BEFORE UPDATE ON protocol_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_protocol_templates_updated_at();

-- Updated at trigger for feedback_templates
CREATE OR REPLACE FUNCTION update_feedback_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS feedback_templates_updated_at ON feedback_templates;
CREATE TRIGGER feedback_templates_updated_at
  BEFORE UPDATE ON feedback_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_templates_updated_at();
