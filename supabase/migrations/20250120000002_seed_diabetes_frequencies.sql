-- ===========================================
-- SEED DIABETES FREQUENCY PROTOCOL NAMES
-- ===========================================
-- Extracted from: agent-assets/diabetes/diabetes-frequencies.pdf (17 pages)
-- Total: 60 protocol names
-- ===========================================

INSERT INTO public.approved_frequency_names (name, category, description) VALUES
  -- Core protocols
  ('Alpha Theta', 'diabetes', 'Alpha Theta brainwave protocol'),
  ('Artery Repair', 'diabetes', 'Artery repair protocol'),
  ('Artery Vitality', 'diabetes', 'Artery vitality support'),
  ('Biotoxin', 'diabetes', 'Biotoxin detoxification protocol'),
  ('Capillary Repair', 'diabetes', 'Capillary repair protocol'),
  ('Capillary Vital', 'diabetes', 'Capillary vitality protocol'),
  ('Concussion SHS', 'diabetes', 'Concussion SHS protocol'),
  ('Constipation 1', 'diabetes', 'Constipation protocol version 1'),
  ('CP-P', 'diabetes', 'CP-P protocol'),
  ('CSF Support', 'diabetes', 'Cerebrospinal fluid support'),
  ('CT SUGAR', 'diabetes', 'Connective tissue sugar protocol'),
  ('Cyto Lower', 'diabetes', 'Cytokine lowering protocol'),
  ('Deuterium', 'diabetes', 'Deuterium protocol'),
  ('DNA Rad', 'diabetes', 'DNA radiation protocol'),
  ('EMF Immune Syste', 'diabetes', 'EMF immune system protocol'),
  ('EMF MITO', 'diabetes', 'EMF mitochondria protocol'),
  ('EMF NS', 'diabetes', 'EMF nervous system protocol'),
  ('GI Path', 'diabetes', 'GI pathogen protocol'),
  ('Gluten Sensitive', 'diabetes', 'Gluten sensitivity protocol'),
  ('Goiter', 'diabetes', 'Goiter protocol'),
  ('Heart Support', 'diabetes', 'Heart support protocol'),
  ('Insulin Resistance 1', 'diabetes', 'Insulin resistance protocol version 1'),
  ('Kidney Repair', 'diabetes', 'Kidney repair protocol'),
  ('Kidney Vitality', 'diabetes', 'Kidney vitality support'),
  ('Large Intestine', 'diabetes', 'Large intestine support'),
  ('Leptin Resist', 'diabetes', 'Leptin resistance protocol'),
  ('Liver Inflame', 'diabetes', 'Liver inflammation protocol'),
  ('Medulla Support', 'diabetes', 'Medulla support protocol'),
  ('Mito Leak 2', 'diabetes', 'Mitochondria leak protocol version 2'),
  ('Mito Tox', 'diabetes', 'Mitochondria toxicity protocol'),
  ('Mito Vitality', 'diabetes', 'Mitochondria vitality protocol'),
  ('MT DNA', 'diabetes', 'Mitochondrial DNA protocol'),
  ('Nerve Pain SHS', 'diabetes', 'Nerve pain SHS protocol'),
  ('NS Tox', 'diabetes', 'Nervous system toxicity protocol'),
  ('Pancreas Beta', 'diabetes', 'Pancreas beta cell protocol'),
  ('Pancreas T2D', 'diabetes', 'Pancreas type 2 diabetes protocol'),
  ('Pars Intermedia', 'diabetes', 'Pars intermedia protocol'),
  ('Pineal Support', 'diabetes', 'Pineal gland support'),
  ('Pituitary A Supp', 'diabetes', 'Pituitary anterior support'),
  ('Pituitary P Supp', 'diabetes', 'Pituitary posterior support'),
  ('PN Diabetes', 'diabetes', 'Peripheral neuropathy diabetes protocol'),
  ('PN Tox', 'diabetes', 'Peripheral neuropathy toxicity protocol'),
  ('PNS Support', 'diabetes', 'Parasympathetic nervous system support'),
  ('Sacral Plexus', 'diabetes', 'Sacral plexus protocol'),
  ('SIBO', 'diabetes', 'Small intestinal bacterial overgrowth protocol'),
  ('Small Intestine', 'diabetes', 'Small intestine support'),
  ('SNS Balance', 'diabetes', 'Sympathetic nervous system balance'),
  ('Solar Plexus', 'diabetes', 'Solar plexus protocol'),
  ('Spleen Support', 'diabetes', 'Spleen support protocol'),
  ('Terrain', 'diabetes', 'Terrain protocol'),
  ('Thyroid +81', 'diabetes', 'Thyroid protocol with 81'),
  ('Thyroid 1', 'diabetes', 'Thyroid protocol version 1'),
  ('Thyroid CT', 'diabetes', 'Thyroid connective tissue protocol'),
  ('Thyroid Graves', 'diabetes', 'Thyroid Graves disease protocol'),
  ('Thyroid Infect', 'diabetes', 'Thyroid infection protocol'),
  ('Thyroid Virus 2', 'diabetes', 'Thyroid virus protocol version 2'),
  ('Vagus Balance', 'diabetes', 'Vagus nerve balance protocol'),
  ('Vagus Support', 'diabetes', 'Vagus nerve support protocol'),
  ('Vein Repair', 'diabetes', 'Vein repair protocol'),
  ('Vein Vitality', 'diabetes', 'Vein vitality protocol')
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
  SELECT COUNT(*) INTO v_count FROM public.approved_frequency_names WHERE category = 'diabetes';
  RAISE NOTICE 'Diabetes frequency protocols loaded: % names', v_count;
END $$;
