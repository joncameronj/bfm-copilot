-- ===========================================
-- SEED HORMONES FREQUENCY PROTOCOL NAMES
-- ===========================================
-- Extracted from: agent-assets/hormones/hormones-frequencies-pt1.pdf (23 pages)
-- Total: 76 protocol names
-- ===========================================

INSERT INTO public.approved_frequency_names (name, category, description) VALUES
  -- Core hormone protocols
  ('Adrenal Quiet Sh', 'hormone', 'Adrenal quiet SH protocol'),
  ('Alpha Theta', 'hormone', 'Alpha Theta brainwave protocol'),
  ('Artery Repair', 'hormone', 'Artery repair protocol'),
  ('Artery Vitality', 'hormone', 'Artery vitality support'),
  ('Biotoxin', 'hormone', 'Biotoxin detoxification protocol'),
  ('Blood Support 2', 'hormone', 'Blood support protocol version 2'),
  ('Bone Calm', 'hormone', 'Bone calming protocol'),
  ('Bone Pain', 'hormone', 'Bone pain protocol'),
  ('Bone Repair 2', 'hormone', 'Bone repair protocol version 2'),
  ('Capillary Repair', 'hormone', 'Capillary repair protocol'),
  ('Capillary Vital', 'hormone', 'Capillary vitality protocol'),
  ('Concussion SHS', 'hormone', 'Concussion SHS protocol'),
  ('Constipation 1', 'hormone', 'Constipation protocol version 1'),
  ('CP-P', 'hormone', 'CP-P protocol'),
  ('CSF Support', 'hormone', 'Cerebrospinal fluid support'),
  ('Cyto Lower', 'hormone', 'Cytokine lowering protocol'),
  ('Deuterium', 'hormone', 'Deuterium protocol'),
  ('DNA Rad', 'hormone', 'DNA radiation protocol'),
  ('Dura Support', 'hormone', 'Dura mater support protocol'),
  ('EMF Cord', 'hormone', 'EMF cord protocol'),
  ('EMF Immune Syste', 'hormone', 'EMF immune system protocol'),
  ('EMF Mito 2', 'hormone', 'EMF mitochondria protocol version 2'),
  ('EMF NS 2', 'hormone', 'EMF nervous system protocol version 2'),
  ('Endometriosis', 'hormone', 'Endometriosis protocol'),
  ('Fallopian Tubes', 'hormone', 'Fallopian tubes protocol'),
  ('Ferritin', 'hormone', 'Ferritin regulation protocol'),
  ('GI Path', 'hormone', 'GI pathogen protocol'),
  ('Heart Support 2', 'hormone', 'Heart support protocol version 2'),
  ('Hormone Balance', 'hormone', 'Hormone balance protocol'),
  ('Hypoxia', 'hormone', 'Hypoxia protocol'),
  ('Kidney Repair', 'hormone', 'Kidney repair protocol'),
  ('Kidney Vitality', 'hormone', 'Kidney vitality support'),
  ('Large Intestine', 'hormone', 'Large intestine support'),
  ('Leptin Resist', 'hormone', 'Leptin resistance protocol'),
  ('Liver Inflame', 'hormone', 'Liver inflammation protocol'),
  ('Locus Coeruleus', 'hormone', 'Locus coeruleus protocol'),
  ('Medulla Support', 'hormone', 'Medulla support protocol'),
  ('Melanin Repair', 'hormone', 'Melanin repair protocol'),
  ('Midbrain Support', 'hormone', 'Midbrain support protocol'),
  ('Mito Function', 'hormone', 'Mitochondria function protocol'),
  ('Mito Leak2', 'hormone', 'Mitochondria leak protocol version 2'),
  ('Mito Tox', 'hormone', 'Mitochondria toxicity protocol'),
  ('Mito Vitality', 'hormone', 'Mitochondria vitality protocol'),
  ('Mold', 'hormone', 'Mold protocol'),
  ('MT DNA', 'hormone', 'Mitochondrial DNA protocol'),
  ('MT DNA Reboot', 'hormone', 'Mitochondrial DNA reboot protocol'),
  ('Nerve Pain Alt', 'hormone', 'Nerve pain alternate protocol'),
  ('NS Tox 2', 'hormone', 'Nervous system toxicity protocol version 2'),
  ('Ovarian Cyst', 'hormone', 'Ovarian cyst protocol'),
  ('Pars Intermedia', 'hormone', 'Pars intermedia protocol'),
  ('PCOS', 'hormone', 'Polycystic ovary syndrome protocol'),
  ('Pineal Support', 'hormone', 'Pineal gland support'),
  ('Pituitary A Supp', 'hormone', 'Pituitary anterior support'),
  ('Pituitary P Supp', 'hormone', 'Pituitary posterior support'),
  ('PNS Support', 'hormone', 'Parasympathetic nervous system support'),
  ('Prostate Plexus', 'hormone', 'Prostate plexus protocol'),
  ('Prostate Support', 'hormone', 'Prostate support protocol'),
  ('Sacral Plexus', 'hormone', 'Sacral plexus protocol'),
  ('Schumann mtDNA', 'hormone', 'Schumann resonance mitochondrial DNA protocol'),
  ('Small Intestine', 'hormone', 'Small intestine support'),
  ('SNS Balance', 'hormone', 'Sympathetic nervous system balance'),
  ('Solar Plexus', 'hormone', 'Solar plexus protocol'),
  ('Spleen Support', 'hormone', 'Spleen support protocol'),
  ('Terrain', 'hormone', 'Terrain protocol'),
  ('Thyroid +81', 'hormone', 'Thyroid protocol with 81'),
  ('Thyroid 1', 'hormone', 'Thyroid protocol version 1'),
  ('Thyroid Infect', 'hormone', 'Thyroid infection protocol'),
  ('Thyroid Virus 2', 'hormone', 'Thyroid virus protocol version 2'),
  ('Uterine Fibroid', 'hormone', 'Uterine fibroid protocol'),
  ('Vagus Balance', 'hormone', 'Vagus nerve balance protocol'),
  ('Vagus MMF', 'hormone', 'Vagus nerve MMF protocol'),
  ('Vagus Support', 'hormone', 'Vagus nerve support protocol'),
  ('Vagus Trauma', 'hormone', 'Vagus nerve trauma protocol'),
  ('Vein Repair', 'hormone', 'Vein repair protocol'),
  ('Vein Vitality', 'hormone', 'Vein vitality protocol'),
  ('Viral 1', 'hormone', 'Viral protocol version 1')
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
  SELECT COUNT(*) INTO v_count FROM public.approved_frequency_names WHERE category = 'hormone';
  RAISE NOTICE 'Hormone frequency protocols loaded: % names', v_count;
END $$;
