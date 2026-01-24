-- ============================================
-- Jack Kruse Educational Content Tags
-- ============================================
-- Tags for categorizing Jack Kruse-related educational content.
-- These enable discovery of circadian biology, light therapy,
-- mitochondrial health, and related content in the knowledge base.
-- ============================================

-- ============================================
-- Jack Kruse Concept Tags
-- ============================================
INSERT INTO public.document_tags (tag_name, tag_type, display_name, description) VALUES
    -- Core Concepts
    ('circadian_biology', 'concept', 'Circadian Biology', 'Study of circadian rhythms and their impact on health'),
    ('circadian_rhythm', 'concept', 'Circadian Rhythm', '24-hour biological cycle, sleep-wake patterns'),
    ('light_therapy', 'concept', 'Light Therapy', 'Therapeutic use of light exposure for health'),
    ('morning_light', 'concept', 'Morning Light Exposure', 'Benefits of early morning sunlight on circadian rhythm'),
    ('blue_light', 'concept', 'Blue Light', 'Effects of blue light exposure on melatonin and sleep'),

    -- Mitochondrial Health
    ('mitochondria', 'concept', 'Mitochondria', 'Cellular energy production, electron transport chain'),
    ('mitochondrial_health', 'concept', 'Mitochondrial Health', 'Optimizing cellular energy production'),
    ('electron_transport_chain', 'concept', 'Electron Transport Chain', 'Mitochondrial ATP production pathway'),
    ('heteroplasmy', 'concept', 'Heteroplasmy', 'Mitochondrial DNA mutation load'),

    -- Cold Thermogenesis
    ('cold_thermogenesis', 'concept', 'Cold Thermogenesis', 'Cold exposure protocols for metabolic health'),
    ('cold_exposure', 'concept', 'Cold Exposure', 'Therapeutic use of cold for health benefits'),
    ('brown_adipose_tissue', 'concept', 'Brown Adipose Tissue', 'BAT, thermogenic fat tissue'),

    -- Light and Water
    ('ez_water', 'concept', 'EZ Water', 'Exclusion zone water, structured water in cells'),
    ('structured_water', 'concept', 'Structured Water', 'Fourth phase of water, cellular hydration'),
    ('photobiomodulation', 'concept', 'Photobiomodulation', 'Light therapy effects on cellular function'),
    ('red_light_therapy', 'concept', 'Red Light Therapy', 'Near-infrared and red light for cellular health'),

    -- EMF and Environment
    ('emf', 'concept', 'EMF', 'Electromagnetic field effects on health'),
    ('non_native_emf', 'concept', 'Non-Native EMF', 'Man-made electromagnetic radiation'),
    ('grounding', 'concept', 'Grounding/Earthing', 'Direct contact with earth for electron transfer'),

    -- Metabolic Concepts
    ('leptin', 'concept', 'Leptin', 'Satiety hormone, metabolic signaling'),
    ('leptin_resistance', 'concept', 'Leptin Resistance', 'Impaired leptin signaling, metabolic dysfunction'),
    ('leptin_reset', 'concept', 'Leptin Reset', 'Protocol for restoring leptin sensitivity'),
    ('metabolic_flexibility', 'concept', 'Metabolic Flexibility', 'Ability to switch between fuel sources'),

    -- Quantum Biology
    ('quantum_biology', 'concept', 'Quantum Biology', 'Quantum effects in biological systems'),
    ('deuterium', 'concept', 'Deuterium', 'Heavy hydrogen, deuterium depletion protocols'),
    ('magnetism', 'concept', 'Magnetism', 'Magnetic field effects on biology'),

    -- Seasonal and Environmental
    ('seasonal_eating', 'concept', 'Seasonal Eating', 'Eating according to local and seasonal availability'),
    ('latitude_health', 'concept', 'Latitude and Health', 'Geographic effects on health and disease'),
    ('solar_spectrum', 'concept', 'Solar Spectrum', 'Full spectrum sunlight and health')
ON CONFLICT (tag_name) DO NOTHING;

-- ============================================
-- Source Tags for Attribution
-- ============================================
INSERT INTO public.document_tags (tag_name, tag_type, display_name, description) VALUES
    ('jack_kruse', 'source', 'Jack Kruse, MD', 'Content from or referencing Jack Kruse'),
    ('kruse_blog', 'source', 'Jack Kruse Blog', 'Articles from jackkruse.com'),
    ('kruse_podcast', 'source', 'Jack Kruse Podcast', 'Podcast episodes featuring Jack Kruse')
ON CONFLICT (tag_name) DO NOTHING;

-- ============================================
-- Condition Relationships for Jack Kruse Concepts
-- ============================================
-- Link circadian concepts to relevant conditions

-- Circadian biology relationships
INSERT INTO public.condition_relationships (source_tag_id, related_tag_id, relationship_type, strength, notes)
SELECT
    s.id, r.id, 'associated_with', 0.7, 'Circadian disruption commonly associated'
FROM public.document_tags s, public.document_tags r
WHERE s.tag_name = 'circadian_rhythm'
AND r.tag_name IN ('insomnia', 'chronic_fatigue', 'depression', 'obesity', 'metabolic_syndrome')
ON CONFLICT DO NOTHING;

-- Light therapy relationships
INSERT INTO public.condition_relationships (source_tag_id, related_tag_id, relationship_type, strength, notes)
SELECT
    s.id, r.id, 'treatment_for', 0.6, 'Light therapy may support'
FROM public.document_tags s, public.document_tags r
WHERE s.tag_name = 'light_therapy'
AND r.tag_name IN ('depression', 'insomnia', 'chronic_fatigue', 'hypothyroidism')
ON CONFLICT DO NOTHING;

-- Cold thermogenesis relationships
INSERT INTO public.condition_relationships (source_tag_id, related_tag_id, relationship_type, strength, notes)
SELECT
    s.id, r.id, 'associated_with', 0.6, 'Cold exposure affects metabolic function'
FROM public.document_tags s, public.document_tags r
WHERE s.tag_name = 'cold_thermogenesis'
AND r.tag_name IN ('obesity', 'insulin_resistance', 'chronic_inflammation', 'metabolic_syndrome')
ON CONFLICT DO NOTHING;

-- Mitochondrial health relationships
INSERT INTO public.condition_relationships (source_tag_id, related_tag_id, relationship_type, strength, notes)
SELECT
    s.id, r.id, 'associated_with', 0.8, 'Mitochondrial dysfunction linked to condition'
FROM public.document_tags s, public.document_tags r
WHERE s.tag_name = 'mitochondrial_health'
AND r.tag_name IN ('chronic_fatigue', 'fibromyalgia', 'brain_fog', 'neuropathy', 'chronic_inflammation')
ON CONFLICT DO NOTHING;

-- Leptin relationships
INSERT INTO public.condition_relationships (source_tag_id, related_tag_id, relationship_type, strength, notes)
SELECT
    s.id, r.id, 'associated_with', 0.7, 'Leptin signaling affects condition'
FROM public.document_tags s, public.document_tags r
WHERE s.tag_name = 'leptin_resistance'
AND r.tag_name IN ('obesity', 'insulin_resistance', 'diabetes_type2', 'metabolic_syndrome', 'pcos')
ON CONFLICT DO NOTHING;

-- ============================================
-- Document Categories for Jack Kruse Content
-- ============================================
-- Note: The actual documents would be uploaded through the admin interface
-- and tagged with these categories. This seed just ensures the tags exist.

-- Verify the educational role scope exists for member-accessible content
-- Documents tagged with role_scope: 'educational' will be visible to members
