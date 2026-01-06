-- ===========================================
-- SEED THYROID FREQUENCY PROTOCOL NAMES
-- ===========================================
-- Extracted from: agent-assets/thyroid/thyroid-frequencies.pdf (22 pages)
-- Total: 74 protocol names
-- ===========================================

INSERT INTO public.approved_frequency_names (name, category, description) VALUES
  -- Page 1
  ('AI EMF', 'thyroid', 'AI EMF protocol from thyroid frequencies'),
  ('Aldehyde Detox', 'thyroid', 'Aldehyde detoxification protocol'),
  ('Alpha Theta', 'thyroid', 'Alpha Theta brainwave protocol'),
  ('Artery Repair', 'thyroid', 'Artery repair protocol'),
  ('Artery Vitality', 'thyroid', 'Artery vitality support'),

  -- Page 2
  ('Autoimmune 2.0', 'thyroid', 'Autoimmune support protocol version 2.0'),
  ('Biotoxin', 'thyroid', 'Biotoxin detoxification protocol'),

  -- Page 3
  ('Blood Support 2', 'thyroid', 'Blood support protocol version 2'),
  ('Bone Calm', 'thyroid', 'Bone calming protocol'),
  ('Bone Repair 2', 'thyroid', 'Bone repair protocol version 2'),

  -- Page 4
  ('Capillary Repair', 'thyroid', 'Capillary repair protocol'),
  ('Capillary Vital', 'thyroid', 'Capillary vitality protocol'),
  ('CDR', 'thyroid', 'Cell Danger Response protocol'),
  ('Concussion SHS', 'thyroid', 'Concussion SHS protocol'),

  -- Page 5
  ('Constipation 1', 'thyroid', 'Constipation protocol version 1'),
  ('CP-P', 'thyroid', 'CP-P protocol'),
  ('CSF Support', 'thyroid', 'Cerebrospinal fluid support'),

  -- Page 6
  ('CT Repair', 'thyroid', 'Connective tissue repair'),
  ('CT Tox', 'thyroid', 'Connective tissue toxicity protocol'),
  ('Cyto Lower', 'thyroid', 'Cytokine lowering protocol'),
  ('DNA', 'thyroid', 'DNA repair protocol'),
  ('DNA Rad', 'thyroid', 'DNA radiation protocol'),
  ('EMF Cord', 'thyroid', 'EMF cord protocol'),
  ('EMF Immune Syste', 'thyroid', 'EMF immune system protocol'),

  -- Page 7
  ('EMF Mito 2', 'thyroid', 'EMF mitochondria protocol version 2'),
  ('EMF NS 2', 'thyroid', 'EMF nervous system protocol version 2'),
  ('Ferritin', 'thyroid', 'Ferritin regulation protocol'),
  ('GI Path', 'thyroid', 'GI pathogen protocol'),
  ('Gluten Sensitive', 'thyroid', 'Gluten sensitivity protocol'),
  ('GR MT DNA', 'thyroid', 'GR mitochondrial DNA protocol'),
  ('Heart Support 2', 'thyroid', 'Heart support protocol version 2'),

  -- Page 8
  ('Immune Support 2', 'thyroid', 'Immune support protocol version 2'),
  ('Kidney Repair', 'thyroid', 'Kidney repair protocol'),
  ('Kidney Vitality', 'thyroid', 'Kidney vitality support'),
  ('Large Intest Sup', 'thyroid', 'Large intestine support'),
  ('Leptin Resist', 'thyroid', 'Leptin resistance protocol'),

  -- Page 9
  ('Liver Inflame', 'thyroid', 'Liver inflammation protocol'),
  ('Medulla Support', 'thyroid', 'Medulla support protocol'),
  ('Melanin Repair', 'thyroid', 'Melanin repair protocol'),
  ('Mito Function', 'thyroid', 'Mitochondria function protocol'),

  -- Page 10
  ('Mito Leak2', 'thyroid', 'Mitochondria leak protocol version 2'),
  ('Mito SupportSHS', 'thyroid', 'Mitochondria support SHS'),
  ('Mito Tox', 'thyroid', 'Mitochondria toxicity protocol'),
  ('Mito Vitality', 'thyroid', 'Mitochondria vitality protocol'),

  -- Page 11
  ('MT DNA', 'thyroid', 'Mitochondrial DNA protocol'),
  ('MT DNA Reboot', 'thyroid', 'Mitochondrial DNA reboot protocol'),
  ('NS Tox 2', 'thyroid', 'Nervous system toxicity protocol version 2'),
  ('Pars Intermedia', 'thyroid', 'Pars intermedia protocol'),

  -- Page 12
  ('Pineal Support', 'thyroid', 'Pineal gland support'),
  ('Pit A Repair', 'thyroid', 'Pituitary anterior repair'),
  ('Pituitary A Supp', 'thyroid', 'Pituitary anterior support'),

  -- Page 13
  ('Pituitary P Supp', 'thyroid', 'Pituitary posterior support'),
  ('PNS Support', 'thyroid', 'Parasympathetic nervous system support'),
  ('Sacral Plexus', 'thyroid', 'Sacral plexus protocol'),

  -- Page 14
  ('SIBO', 'thyroid', 'Small intestinal bacterial overgrowth protocol'),
  ('Small Intestine', 'thyroid', 'Small intestine support'),

  -- Page 15
  ('SNS Balance', 'thyroid', 'Sympathetic nervous system balance'),
  ('Solar Plexus', 'thyroid', 'Solar plexus protocol'),

  -- Page 16
  ('Spleen Support', 'thyroid', 'Spleen support protocol'),
  ('Terrain', 'thyroid', 'Terrain protocol'),

  -- Page 17
  ('Thyroid +81', 'thyroid', 'Thyroid protocol with 81'),

  -- Page 18
  ('Thyroid 1', 'thyroid', 'Thyroid protocol version 1'),
  ('Thyroid CT', 'thyroid', 'Thyroid connective tissue protocol'),

  -- Page 19
  ('Thyroid Goiter', 'thyroid', 'Thyroid goiter protocol'),
  ('Thyroid Graves', 'thyroid', 'Thyroid Graves disease protocol'),
  ('Thyroid Infect', 'thyroid', 'Thyroid infection protocol'),

  -- Page 20
  ('Thyroid Virus 2', 'thyroid', 'Thyroid virus protocol version 2'),
  ('Vagus Balance', 'thyroid', 'Vagus nerve balance protocol'),
  ('Vagus Support', 'thyroid', 'Vagus nerve support protocol'),
  ('Vagus Trauma', 'thyroid', 'Vagus nerve trauma protocol'),
  ('Vein Repair', 'thyroid', 'Vein repair protocol'),

  -- Page 21
  ('Vein Vitality', 'thyroid', 'Vein vitality protocol'),
  ('Viral 1', 'thyroid', 'Viral protocol version 1'),
  ('Viral T&S', 'thyroid', 'Viral T&S protocol')
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ===========================================
-- VERIFICATION
-- ===========================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.approved_frequency_names WHERE category = 'thyroid';
  RAISE NOTICE 'Thyroid frequency protocols loaded: % names', v_count;
END $$;
