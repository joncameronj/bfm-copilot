-- ===========================================
-- RESEED ALL APPROVED FREQUENCY PROTOCOL NAMES
-- ===========================================
-- Comprehensive reseed of all protocols from protocol-accuracy.md
-- This includes ALL 200+ protocols from:
-- - Thyroid (74 protocols)
-- - Hormones Part 1 (76 protocols)
-- - Neurological (49 protocols)
-- - Diabetes (60 protocols)
-- Plus additional protocols from Sunday docs
-- ===========================================

-- First, ensure we have clean data
TRUNCATE public.approved_frequency_names RESTART IDENTITY CASCADE;

-- ===========================================
-- THYROID FREQUENCIES (74 protocols)
-- Source: agent-assets/thyroid/thyroid-frequencies.pdf
-- ===========================================
INSERT INTO public.approved_frequency_names (name, category, description) VALUES
  ('AI EMF', 'general', 'AI EMF protocol'),
  ('Aldehyde Detox', 'general', 'Aldehyde detoxification protocol'),
  ('Alpha Theta', 'general', 'Alpha Theta brainwave protocol - used when alpha is low or theta > alpha'),
  ('Artery Repair', 'general', 'Artery repair protocol'),
  ('Artery Vitality', 'general', 'Artery vitality support'),
  ('Autoimmune 2.0', 'general', 'Autoimmune support protocol version 2.0'),
  ('Biotoxin', 'general', 'Biotoxin detoxification protocol - use when VCS failed or biotoxin illness'),
  ('Blood Support 2', 'general', 'Blood support protocol version 2'),
  ('Bone Calm', 'general', 'Bone calming protocol'),
  ('Bone Repair 2', 'general', 'Bone repair protocol version 2'),
  ('Capillary Repair', 'general', 'Capillary repair protocol'),
  ('Capillary Vital', 'general', 'Capillary vitality protocol'),
  ('CDR', 'general', 'Cell Danger Response protocol - run AFTER all deal breakers resolved'),
  ('Concussion SHS', 'general', 'Concussion SHS protocol'),
  ('Constipation 1', 'general', 'Constipation protocol version 1'),
  ('CP-P', 'general', 'Central Pain Protocol - use when beta is dominant or midbrain set point high'),
  ('CSF Support', 'general', 'Cerebrospinal fluid support'),
  ('CT Repair', 'general', 'Connective tissue repair'),
  ('CT Tox', 'general', 'Connective tissue toxicity protocol'),
  ('Cyto Lower', 'general', 'Cytokine lowering protocol - use for high cytokines'),
  ('DNA', 'general', 'DNA repair protocol'),
  ('DNA Rad', 'general', 'DNA radiation protocol'),
  ('EMF Cord', 'general', 'EMF cord protocol'),
  ('EMF Immune Syste', 'general', 'EMF immune system protocol'),
  ('EMF Mito 2', 'general', 'EMF mitochondria protocol version 2'),
  ('EMF NS 2', 'general', 'EMF nervous system protocol version 2'),
  ('Ferritin', 'general', 'Ferritin regulation protocol'),
  ('GI Path', 'general', 'GI pathogen protocol'),
  ('Gluten Sensitive', 'general', 'Gluten sensitivity protocol'),
  ('GR MT DNA', 'general', 'GR mitochondrial DNA protocol'),
  ('Heart Support 2', 'general', 'Heart support protocol version 2 - use when heart is red on D-Pulse'),
  ('Immune Support 2', 'general', 'Immune support protocol version 2'),
  ('Kidney Repair', 'general', 'Kidney repair protocol - use for low eGFR or kidney issues'),
  ('Kidney Vitality', 'general', 'Kidney vitality support - use for kidney dysfunction'),
  ('Kidney Support', 'general', 'Kidney support protocol'),
  ('Large Intest Sup', 'general', 'Large intestine support'),
  ('Leptin Resist', 'general', 'Leptin resistance protocol - use for failed VCS or leptin issues'),
  ('Liver Inflame', 'general', 'Liver inflammation protocol - use for elevated ALT/AST'),
  ('Medulla Support', 'general', 'Medulla support protocol - use for low cervical/thoracic on D-Pulse'),
  ('Melanin Repair', 'general', 'Melanin repair protocol - use for high delta brainwaves'),
  ('Mito Function', 'general', 'Mitochondria function protocol'),
  ('Mito Leak2', 'general', 'Mitochondria leak protocol version 2'),
  ('Mito SupportSHS', 'general', 'Mitochondria support SHS'),
  ('Mito Tox', 'general', 'Mitochondria toxicity protocol'),
  ('Mito Vitality', 'general', 'Mitochondria vitality protocol'),
  ('MT DNA', 'general', 'Mitochondrial DNA protocol'),
  ('MT DNA Reboot', 'general', 'Mitochondrial DNA reboot protocol'),
  ('NS Tox 2', 'general', 'Nervous system toxicity protocol version 2'),
  ('Pars Intermedia', 'general', 'Pars intermedia protocol'),
  ('Pineal Support', 'general', 'Pineal gland support'),
  ('Pit A Repair', 'general', 'Pituitary anterior repair'),
  ('Pituitary A Supp', 'general', 'Pituitary anterior support'),
  ('Pituitary P Supp', 'general', 'Pituitary posterior support - use for thyroid with pituitary involvement'),
  ('Pit P Support', 'general', 'Pituitary P support - alias for Pituitary P Supp'),
  ('PNS Support', 'general', 'Parasympathetic nervous system support - use for PNS negative'),
  ('Sacral Plexus', 'general', 'Sacral plexus protocol - use for diabetes with autonomic involvement'),
  ('SIBO', 'general', 'Small intestinal bacterial overgrowth protocol'),
  ('Small Intestine', 'general', 'Small intestine support'),
  ('SNS Balance', 'general', 'Sympathetic nervous system balance - use for SNS switched or high stress'),
  ('Solar Plexus', 'general', 'Solar plexus protocol'),
  ('Spleen Support', 'general', 'Spleen support protocol'),
  ('Terrain', 'general', 'Terrain protocol'),
  ('Thyroid +81', 'thyroid', 'Thyroid protocol with 81'),
  ('Thyroid 1', 'thyroid', 'Thyroid protocol version 1'),
  ('Thyroid CT', 'thyroid', 'Thyroid connective tissue protocol'),
  ('Thyroid Goiter', 'thyroid', 'Thyroid goiter protocol'),
  ('Thyroid Graves', 'thyroid', 'Thyroid Graves disease protocol'),
  ('Thyroid Infect', 'thyroid', 'Thyroid infection protocol'),
  ('Thyroid Virus 2', 'thyroid', 'Thyroid virus protocol version 2'),
  ('Vagus Balance', 'general', 'Vagus nerve balance protocol'),
  ('Vagus Support', 'general', 'Vagus nerve support protocol - use for vagus nerve issues'),
  ('Vagus Trauma', 'general', 'Vagus nerve trauma protocol'),
  ('Vein Repair', 'general', 'Vein repair protocol'),
  ('Vein Vitality', 'general', 'Vein vitality protocol'),
  ('Viral 1', 'general', 'Viral protocol version 1'),
  ('Viral T&S', 'general', 'Viral T&S protocol')
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ===========================================
-- HORMONES FREQUENCIES PART 1 (additional 20 protocols not in thyroid)
-- Source: agent-assets/hormones/hormones-frequencies-pt1.pdf
-- ===========================================
INSERT INTO public.approved_frequency_names (name, category, description) VALUES
  ('Adrenal Quiet Sh', 'hormones', 'Adrenal quieting SHS protocol'),
  ('Bone Pain', 'general', 'Bone pain protocol'),
  ('Deuterium', 'general', 'Deuterium protocol'),
  ('Dura Support', 'general', 'Dura mater support'),
  ('Endometriosis', 'hormones', 'Endometriosis protocol'),
  ('Fallopian Tubes', 'hormones', 'Fallopian tubes protocol'),
  ('Hormone Balance', 'hormones', 'Hormone balance protocol'),
  ('Hypoxia', 'general', 'Hypoxia protocol'),
  ('Large Intestine', 'general', 'Large intestine protocol'),
  ('Locus Coeruleus', 'general', 'Locus coeruleus protocol'),
  ('Midbrain Support', 'general', 'Midbrain support protocol'),
  ('Mold', 'general', 'Mold protocol'),
  ('Nerve Pain Alt', 'general', 'Nerve pain alternate protocol'),
  ('Ovarian Cyst', 'hormones', 'Ovarian cyst protocol'),
  ('PCOS', 'hormones', 'Polycystic ovary syndrome protocol'),
  ('Prostate Plexus', 'hormones', 'Prostate plexus protocol'),
  ('Prostate Support', 'hormones', 'Prostate support protocol'),
  ('Schumann mtDNA', 'general', 'Schumann mtDNA protocol'),
  ('Uterine Fibroid', 'hormones', 'Uterine fibroid protocol'),
  ('Vagus MMF', 'general', 'Vagus MMF protocol')
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ===========================================
-- NEUROLOGICAL FREQUENCIES (additional 15 protocols not already added)
-- Source: agent-assets/neurological/neuro-frequencies.pdf
-- ===========================================
INSERT INTO public.approved_frequency_names (name, category, description) VALUES
  ('58/.01', 'neurological', '58/.01 frequency protocol'),
  ('81/89', 'neurological', '81/89 frequency protocol'),
  ('Amygdala Calm', 'neurological', 'Amygdala calming protocol'),
  ('Basal Gang Stim', 'neurological', 'Basal ganglia stimulation'),
  ('Brain Balance', 'neurological', 'Brain balance protocol'),
  ('Brain Protein', 'neurological', 'Brain protein protocol'),
  ('Cord Degen', 'neurological', 'Cord degeneration protocol'),
  ('Cord Stim', 'neurological', 'Cord stimulation protocol'),
  ('CTF-P', 'neurological', 'CTF-P protocol'),
  ('EMF MITO', 'general', 'EMF mitochondria protocol'),
  ('Forebrain Suppor', 'neurological', 'Forebrain support'),
  ('Hindbrain Stim', 'neurological', 'Hindbrain stimulation'),
  ('Hindbrain Suppor', 'neurological', 'Hindbrain support'),
  ('Medulla Calm', 'neurological', 'Medulla calming protocol'),
  ('Mito Energy', 'general', 'Mitochondria energy protocol'),
  ('Mito Support', 'general', 'Mitochondria support protocol'),
  ('MS Attack', 'neurological', 'Multiple sclerosis attack protocol'),
  ('Nerve Pain SHS', 'neurological', 'Nerve pain SHS protocol'),
  ('Nerve Stim', 'neurological', 'Nerve stimulation protocol'),
  ('SM Stim', 'neurological', 'SM stimulation protocol'),
  ('Sympathetic Calm', 'general', 'Sympathetic calming protocol'),
  ('Vein Support', 'general', 'Vein support protocol')
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ===========================================
-- DIABETES FREQUENCIES (additional 10 protocols not already added)
-- Source: agent-assets/diabetes/diabetes-frequencies.pdf
-- ===========================================
INSERT INTO public.approved_frequency_names (name, category, description) VALUES
  ('CT SUGAR', 'diabetes', 'Connective tissue sugar protocol'),
  ('EMF NS', 'general', 'EMF nervous system protocol'),
  ('Goiter', 'thyroid', 'Goiter protocol'),
  ('Heart Support', 'general', 'Heart support protocol'),
  ('Insulin Resis#1', 'diabetes', 'Insulin resistance protocol #1'),
  ('Mito Leak 2', 'general', 'Mitochondria leak protocol 2'),
  ('NS Tox', 'general', 'Nervous system toxicity protocol'),
  ('Pancreas Beta', 'diabetes', 'Pancreas beta cell protocol'),
  ('Pancreas T2D', 'diabetes', 'Pancreas type 2 diabetes protocol'),
  ('PN Diabetes', 'diabetes', 'Peripheral neuropathy diabetes protocol'),
  ('PN Tox', 'diabetes', 'Peripheral neuropathy toxicity protocol'),
  ('NS EMF', 'general', 'Nervous system EMF protocol - use for EMF exposure or anemia patterns')
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ===========================================
-- ADDITIONAL PROTOCOLS FROM SUNDAY DOCS
-- ===========================================
INSERT INTO public.approved_frequency_names (name, category, description) VALUES
  ('Switch Sympathetics', 'general', 'Sympathetic switching protocol - deal breaker #1'),
  ('Heart Health', 'general', 'Heart health protocol'),
  ('Liver Tox', 'general', 'Liver toxicity protocol'),
  ('Melanin', 'general', 'Melanin protocol - use for high waking delta'),
  ('Concussion Brain Balance', 'neurological', 'Concussion brain balance protocol')
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ===========================================
-- VERIFICATION
-- ===========================================
DO $$
DECLARE
  v_total INTEGER;
  v_general INTEGER;
  v_thyroid INTEGER;
  v_hormones INTEGER;
  v_neurological INTEGER;
  v_diabetes INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.approved_frequency_names;
  SELECT COUNT(*) INTO v_general FROM public.approved_frequency_names WHERE category = 'general';
  SELECT COUNT(*) INTO v_thyroid FROM public.approved_frequency_names WHERE category = 'thyroid';
  SELECT COUNT(*) INTO v_hormones FROM public.approved_frequency_names WHERE category = 'hormones';
  SELECT COUNT(*) INTO v_neurological FROM public.approved_frequency_names WHERE category = 'neurological';
  SELECT COUNT(*) INTO v_diabetes FROM public.approved_frequency_names WHERE category = 'diabetes';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'APPROVED FREQUENCY NAMES LOADED';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total protocols: %', v_total;
  RAISE NOTICE 'General: %', v_general;
  RAISE NOTICE 'Thyroid: %', v_thyroid;
  RAISE NOTICE 'Hormones: %', v_hormones;
  RAISE NOTICE 'Neurological: %', v_neurological;
  RAISE NOTICE 'Diabetes: %', v_diabetes;
  RAISE NOTICE '========================================';
END $$;
