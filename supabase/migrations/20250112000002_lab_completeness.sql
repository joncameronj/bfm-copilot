-- Migration: Add completeness tracking to lab_results

-- Add is_complete flag to track partial lab uploads
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'lab_results' AND column_name = 'is_complete') THEN
    ALTER TABLE lab_results ADD COLUMN is_complete boolean DEFAULT true;
  END IF;
END $$;

-- Add missing_markers array to track which markers were not filled
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'lab_results' AND column_name = 'missing_markers') THEN
    ALTER TABLE lab_results ADD COLUMN missing_markers text[] DEFAULT '{}';
  END IF;
END $$;

-- Add extraction_confidence to track AI parsing confidence
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'lab_results' AND column_name = 'extraction_confidence') THEN
    ALTER TABLE lab_results ADD COLUMN extraction_confidence numeric;
  END IF;
END $$;

-- Add source_type to distinguish between manual entry and PDF upload
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'lab_results' AND column_name = 'source_type') THEN
    ALTER TABLE lab_results ADD COLUMN source_type text DEFAULT 'manual';
    -- source_type can be: 'manual', 'pdf_upload', 'imported'
  END IF;
END $$;

-- Create index for filtering by completeness
CREATE INDEX IF NOT EXISTS idx_lab_results_complete ON lab_results(is_complete);

-- Add confidence score to individual lab_values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'lab_values' AND column_name = 'confidence') THEN
    ALTER TABLE lab_values ADD COLUMN confidence numeric;
  END IF;
END $$;

-- Add is_empty flag for markers that were detected but had no value
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'lab_values' AND column_name = 'is_empty') THEN
    ALTER TABLE lab_values ADD COLUMN is_empty boolean DEFAULT false;
  END IF;
END $$;
