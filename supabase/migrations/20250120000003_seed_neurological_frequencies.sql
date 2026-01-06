-- ===========================================
-- SEED NEUROLOGICAL FREQUENCY PROTOCOL NAMES
-- ===========================================
-- Extracted from: agent-assets/neurological/neuro-frequencies.pdf (13 pages)
-- Total: 49 protocol names
-- ===========================================

INSERT INTO public.approved_frequency_names (name, category, description) VALUES
  -- Core neurological protocols
  ('58/.01', 'neurological', '58/.01 protocol'),
  ('81/89', 'neurological', '81/89 protocol'),
  ('Amygdala Calm', 'neurological', 'Amygdala calming protocol'),
  ('Artery Repair', 'neurological', 'Artery repair protocol'),
  ('Artery Vitality', 'neurological', 'Artery vitality support'),
  ('Basal Gang Stim', 'neurological', 'Basal ganglia stimulation protocol'),
  ('Biotoxin', 'neurological', 'Biotoxin detoxification protocol'),
  ('Brain Balance', 'neurological', 'Brain balance protocol'),
  ('Brain Protein', 'neurological', 'Brain protein protocol'),
  ('Capillary Repair', 'neurological', 'Capillary repair protocol'),
  ('Capillary Vital', 'neurological', 'Capillary vitality protocol'),
  ('Concussion SHS', 'neurological', 'Concussion SHS protocol'),
  ('Cord Degen', 'neurological', 'Spinal cord degeneration protocol'),
  ('Cord Stim', 'neurological', 'Spinal cord stimulation protocol'),
  ('CP-P', 'neurological', 'Central Pain-Positive protocol'),
  ('CTF-P', 'neurological', 'CTF-P protocol'),
  ('Cyto Lower', 'neurological', 'Cytokine lowering protocol'),
  ('EMF MITO', 'neurological', 'EMF mitochondria protocol'),
  ('EMF NS 2', 'neurological', 'EMF nervous system protocol version 2'),
  ('Forebrain Suppor', 'neurological', 'Forebrain support protocol'),
  ('Hindbrain Stim', 'neurological', 'Hindbrain stimulation protocol'),
  ('Hindbrain Suppor', 'neurological', 'Hindbrain support protocol'),
  ('Kidney Repair', 'neurological', 'Kidney repair protocol'),
  ('Kidney Vitality', 'neurological', 'Kidney vitality support'),
  ('Leptin Resist', 'neurological', 'Leptin resistance protocol'),
  ('Liver Inflame', 'neurological', 'Liver inflammation protocol'),
  ('Locus Coeruleus', 'neurological', 'Locus coeruleus protocol'),
  ('Medulla Calm', 'neurological', 'Medulla calming protocol'),
  ('Midbrain Support', 'neurological', 'Midbrain support protocol'),
  ('Mito Energy', 'neurological', 'Mitochondria energy protocol'),
  ('Mito Support', 'neurological', 'Mitochondria support protocol'),
  ('Mito Tox', 'neurological', 'Mitochondria toxicity protocol'),
  ('MS Attack', 'neurological', 'Multiple sclerosis attack protocol'),
  ('Nerve Pain SHS', 'neurological', 'Nerve pain SHS protocol'),
  ('Nerve Stim', 'neurological', 'Nerve stimulation protocol'),
  ('Pars Intermedia', 'neurological', 'Pars intermedia protocol'),
  ('Pineal Support', 'neurological', 'Pineal gland support'),
  ('Pituitary A Supp', 'neurological', 'Pituitary anterior support'),
  ('Pituitary P Supp', 'neurological', 'Pituitary posterior support'),
  ('Sacral Plexus', 'neurological', 'Sacral plexus protocol'),
  ('SM Stim', 'neurological', 'Sensorimotor stimulation protocol'),
  ('Sympathetic Calm', 'neurological', 'Sympathetic nervous system calming'),
  ('Terrain', 'neurological', 'Terrain protocol'),
  ('Thyroid +81', 'neurological', 'Thyroid protocol with 81'),
  ('Thyroid 1', 'neurological', 'Thyroid protocol version 1'),
  ('Thyroid Infect', 'neurological', 'Thyroid infection protocol'),
  ('Thyroid Virus 2', 'neurological', 'Thyroid virus protocol version 2'),
  ('Vein Repair', 'neurological', 'Vein repair protocol'),
  ('Vein Support', 'neurological', 'Vein support protocol')
ON CONFLICT (name) DO UPDATE SET
  category = COALESCE(EXCLUDED.category, public.approved_frequency_names.category),
  description = COALESCE(EXCLUDED.description, public.approved_frequency_names.description),
  updated_at = NOW();

-- ===========================================
-- VERIFICATION
-- ===========================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.approved_frequency_names WHERE category = 'neurological';
  RAISE NOTICE 'Neurological frequency protocols loaded: % names', v_count;
END $$;
