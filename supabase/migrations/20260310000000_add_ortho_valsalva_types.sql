-- Add ortho and valsalva to the diagnostic_type enum
-- These are NervExpress test types used for HRV superimposition detection
-- (Locus Coeruleus and NS Toxicity indicators)

ALTER TYPE diagnostic_type ADD VALUE IF NOT EXISTS 'ortho';
ALTER TYPE diagnostic_type ADD VALUE IF NOT EXISTS 'valsalva';
