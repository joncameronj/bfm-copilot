-- Migration: Add master_reference document category and update supplement patterns
-- Enables ingestion of the BFM Master Protocol Key as a distinct document type
-- that receives highest priority in RAG search.

-- ============================================
-- 1. Update document_category constraint to include master_reference
-- ============================================

ALTER TABLE public.documents
    DROP CONSTRAINT IF EXISTS check_document_category;

ALTER TABLE public.documents
    ADD CONSTRAINT check_document_category CHECK (
        document_category IS NULL OR document_category IN (
            -- Original categories
            'protocol',
            'lab_guide',
            'care_guide',
            'reference',
            'patient_education',
            'case_study',
            -- Ingestion categories
            'seminar_transcript',
            'hrv_assessment',
            'frequency_reference',
            'image_extraction',
            'other',
            -- Master protocol key (highest priority in RAG)
            'master_reference'
        )
    );

-- ============================================
-- 2. Update prioritized_search_documents to boost master_reference
-- ============================================
-- Master reference documents get searched FIRST (before Sunday docs)
-- since they are the definitive source of truth.

CREATE OR REPLACE FUNCTION prioritized_search_documents(
    p_query_embedding vector(1536),
    p_user_id UUID,
    p_user_role TEXT DEFAULT 'practitioner',
    p_care_categories TEXT[] DEFAULT NULL,
    p_diagnostic_types TEXT[] DEFAULT NULL,
    p_match_threshold FLOAT DEFAULT 0.5,
    p_sunday_count INT DEFAULT 5,
    p_other_count INT DEFAULT 10
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    content TEXT,
    title TEXT,
    filename TEXT,
    care_category TEXT,
    document_category TEXT,
    seminar_day TEXT,
    similarity FLOAT,
    search_phase TEXT,
    priority_rank INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Phase 0: Master Reference documents FIRST (authoritative protocol key)
    -- These are the DEFINITIVE source of truth — always searched with lowest threshold
    RETURN QUERY
    SELECT
        dc.id AS chunk_id,
        dc.document_id,
        dc.content,
        d.title,
        d.filename,
        d.care_category,
        d.document_category,
        d.seminar_day,
        1 - (dc.embedding <=> p_query_embedding) AS similarity,
        'master_reference'::TEXT AS search_phase,
        0 AS priority_rank
    FROM public.document_chunks dc
    JOIN public.documents d ON dc.document_id = d.id
    WHERE d.status IN ('completed', 'indexed')
      AND (d.user_id = p_user_id OR d.is_global = TRUE)
      AND d.document_category = 'master_reference'
      AND (p_care_categories IS NULL OR d.care_category = ANY(p_care_categories) OR d.care_category = 'general')
      AND 1 - (dc.embedding <=> p_query_embedding) > (p_match_threshold - 0.15)
      AND (
          p_user_role IN ('practitioner', 'admin')
          OR d.role_scope IN ('educational', 'both')
      )
    ORDER BY similarity DESC
    LIMIT 5;

    -- Phase 1: Sunday documents (tactical case study walkthroughs)
    RETURN QUERY
    SELECT
        dc.id AS chunk_id,
        dc.document_id,
        dc.content,
        d.title,
        d.filename,
        d.care_category,
        d.document_category,
        d.seminar_day,
        1 - (dc.embedding <=> p_query_embedding) AS similarity,
        'sunday_primary'::TEXT AS search_phase,
        1 AS priority_rank
    FROM public.document_chunks dc
    JOIN public.documents d ON dc.document_id = d.id
    WHERE d.status IN ('completed', 'indexed')
      AND (d.user_id = p_user_id OR d.is_global = TRUE)
      AND d.seminar_day = 'sunday'
      AND (p_care_categories IS NULL OR d.care_category = ANY(p_care_categories))
      AND 1 - (dc.embedding <=> p_query_embedding) > (p_match_threshold - 0.1)
      AND (
          p_user_role IN ('practitioner', 'admin')
          OR d.role_scope IN ('educational', 'both')
      )
    ORDER BY similarity DESC
    LIMIT p_sunday_count;

    -- Phase 2: Other seminar transcripts (Saturday/Friday)
    RETURN QUERY
    SELECT
        dc.id AS chunk_id,
        dc.document_id,
        dc.content,
        d.title,
        d.filename,
        d.care_category,
        d.document_category,
        d.seminar_day,
        1 - (dc.embedding <=> p_query_embedding) AS similarity,
        'seminar_secondary'::TEXT AS search_phase,
        2 AS priority_rank
    FROM public.document_chunks dc
    JOIN public.documents d ON dc.document_id = d.id
    WHERE d.status IN ('completed', 'indexed')
      AND (d.user_id = p_user_id OR d.is_global = TRUE)
      AND d.document_category = 'seminar_transcript'
      AND (d.seminar_day IS NULL OR d.seminar_day != 'sunday')
      AND (p_care_categories IS NULL OR d.care_category = ANY(p_care_categories))
      AND 1 - (dc.embedding <=> p_query_embedding) > p_match_threshold
      AND (
          p_user_role IN ('practitioner', 'admin')
          OR d.role_scope IN ('educational', 'both')
      )
    ORDER BY similarity DESC
    LIMIT GREATEST(p_other_count / 2, 3);

    -- Phase 3: Frequency reference documents
    RETURN QUERY
    SELECT
        dc.id AS chunk_id,
        dc.document_id,
        dc.content,
        d.title,
        d.filename,
        d.care_category,
        d.document_category,
        d.seminar_day,
        1 - (dc.embedding <=> p_query_embedding) AS similarity,
        'frequency_reference'::TEXT AS search_phase,
        3 AS priority_rank
    FROM public.document_chunks dc
    JOIN public.documents d ON dc.document_id = d.id
    WHERE d.status IN ('completed', 'indexed')
      AND (d.user_id = p_user_id OR d.is_global = TRUE)
      AND d.document_category = 'frequency_reference'
      AND (p_care_categories IS NULL OR d.care_category = ANY(p_care_categories))
      AND 1 - (dc.embedding <=> p_query_embedding) > p_match_threshold
      AND (
          p_user_role IN ('practitioner', 'admin')
          OR d.role_scope IN ('educational', 'both')
      )
    ORDER BY similarity DESC
    LIMIT 3;

    -- Phase 4: Other relevant documents (protocols, lab guides, etc.)
    RETURN QUERY
    SELECT
        dc.id AS chunk_id,
        dc.document_id,
        dc.content,
        d.title,
        d.filename,
        d.care_category,
        d.document_category,
        d.seminar_day,
        1 - (dc.embedding <=> p_query_embedding) AS similarity,
        'supplementary'::TEXT AS search_phase,
        4 AS priority_rank
    FROM public.document_chunks dc
    JOIN public.documents d ON dc.document_id = d.id
    WHERE d.status IN ('completed', 'indexed')
      AND (d.user_id = p_user_id OR d.is_global = TRUE)
      AND d.document_category NOT IN ('seminar_transcript', 'frequency_reference', 'master_reference')
      AND (p_care_categories IS NULL OR d.care_category = ANY(p_care_categories))
      AND 1 - (dc.embedding <=> p_query_embedding) > p_match_threshold
      AND (
          p_user_role IN ('practitioner', 'admin')
          OR d.role_scope IN ('educational', 'both')
      )
    ORDER BY similarity DESC
    LIMIT p_other_count / 2;
END;
$$;

COMMENT ON FUNCTION prioritized_search_documents(vector(1536), UUID, TEXT, TEXT[], TEXT[], FLOAT, INT, INT)
    IS 'RAG search that prioritizes Master Reference docs first, then Sunday BFM transcripts, then other seminars, then frequency references, then supplementary docs';

-- ============================================
-- 3. Add missing frequency names from Master Protocol Key
-- ============================================
-- These frequencies appear in the master protocol key but were missing from the DB

INSERT INTO public.approved_frequency_names (name, aliases, category, description)
VALUES
    -- Deal Breaker frequencies
    ('Vagas Balance', ARRAY['Vagus Balance', 'Vegas Balance'], 'autonomic', 'Vagus nerve balance frequency - used when SNS also switched'),
    ('Vagas Trauma', ARRAY['Vagus Trauma', 'Vegas Trauma'], 'autonomic', 'Vagus nerve trauma frequency - 1hr for severe vagus dysfunction'),
    ('Vagus Support', ARRAY['Vagus Support basic'], 'autonomic', 'Basic vagus support frequency'),
    ('Heart Health', ARRAY['Heart Support'], 'cardiovascular', 'Heart health frequency for low heart on D-Pulse'),
    ('Terrain', ARRAY[]::TEXT[], 'metabolic', 'Terrain frequency for low pH when supplements do not move pH'),

    -- HRV & Brainwave frequencies
    ('Locus Coeruleus Support', ARRAY['Locus Coeruleus'], 'neurological', 'Freeze response pattern on HRV'),
    ('NS Tox', ARRAY['NS Toxicity', 'Nervous System Toxicity'], 'neurological', 'Nervous system toxicity pattern'),
    ('Vein Vitality/Repair', ARRAY['Vein Vitality', 'Vein Repair'], 'cardiovascular', 'POTS pattern - vein support'),
    ('Vegas Support', ARRAY[]::TEXT[], 'autonomic', 'Vegas support frequency for POTS'),
    ('Midbrain Support', ARRAY[]::TEXT[], 'neurological', 'High gamma (>40%) - racing thoughts'),

    -- D-Pulse organ frequencies
    ('Liver Inflame', ARRAY['Liver Inflammation'], 'hepatic', 'Liver inflammation frequency for elevated enzymes'),
    ('Liver Tox', ARRAY['Liver Toxicity'], 'hepatic', 'General liver toxicity frequency'),
    ('Gallbladder Support', ARRAY[]::TEXT[], 'digestive', 'Low gallbladder on D-Pulse'),
    ('Lung Support', ARRAY[]::TEXT[], 'respiratory', 'Low lungs on D-Pulse'),
    ('Bladder Support', ARRAY[]::TEXT[], 'urinary', 'Low bladder scores on D-Pulse'),

    -- Lab mapping frequencies
    ('Mito Leak', ARRAY['Mito Leak 1', 'Mitochondrial Leak'], 'mitochondrial', 'Elevated CRP - Complex 1 mitochondrial leaking'),
    ('Ferritin Lower', ARRAY[]::TEXT[], 'metabolic', 'High ferritin + low iron pattern'),
    ('Kidney Inflame', ARRAY['Kidney Inflammation'], 'urinary', 'High Pro-BNP - very effective for cardiac markers'),
    ('Small Intestine', ARRAY[]::TEXT[], 'digestive', 'Low HDL - small intestine leaking'),
    ('Thyroid 1', ARRAY[]::TEXT[], 'thyroid', 'TPO antibodies positive - Hashimoto thyroiditis'),
    ('Thyroid Infect', ARRAY['Thyroid Infection'], 'thyroid', 'TGB antibodies positive - more dangerous marker'),
    ('Thyroid +81', ARRAY['Thyroid Plus 81'], 'thyroid', 'High TSH / Low T4 - simple hypothalayroid'),
    ('Thyroid Virus', ARRAY[]::TEXT[], 'thyroid', 'Post-COVID thyroid damage'),
    ('Graves', ARRAY['Graves Disease'], 'thyroid', 'Hyperthyroid autoimmune'),
    ('Thyroid Goiter', ARRAY[]::TEXT[], 'thyroid', 'Mass on thyroid found'),
    ('Thyroid CT', ARRAY[]::TEXT[], 'thyroid', 'Thyroid CT scan related frequency'),
    ('EMF Cord', ARRAY[]::TEXT[], 'environmental', 'Elevated BUN:Creatinine - EMF damage / dehydration'),
    ('Leptin Resist', ARRAY['Leptin Resistance'], 'metabolic', 'High leptin - gates ALL other hormones'),
    ('Pit A Support', ARRAY['Pituitary A Support', 'Anterior Pituitary Support'], 'endocrine', 'Low MSH (<8-40) - cant stimulate endorphins'),
    ('Par Intermedia', ARRAY['Pars Intermedia'], 'endocrine', 'Low MSH - pars intermedia support'),
    ('Mito Tox', ARRAY['Mitochondrial Toxicity'], 'mitochondrial', 'VCS failed + potential antibodies - biotoxic illness'),
    ('CDR', ARRAY['Cell Danger Response'], 'immune', 'Cardiolipin antibodies positive - mitochondrial damage'),
    ('Virus Recovery', ARRAY[]::TEXT[], 'immune', 'Spike protein >1000 - active COVID/vaccine spike load'),
    ('Insulin Resist', ARRAY['Insulin Resistance'], 'metabolic', 'Insulin resistance pattern'),
    ('Pancreas T2D', ARRAY['Pancreas Type 2 Diabetes'], 'metabolic', 'Pancreatic dysfunction T2D'),
    ('SIBO', ARRAY[]::TEXT[], 'digestive', 'SIBO confirmed - nightly 4-6 weeks'),
    ('Aldehyde Detox', ARRAY[]::TEXT[], 'detox', 'High uric acid - ammonia/acetaldehyde'),
    ('Blood Support', ARRAY[]::TEXT[], 'cardiovascular', 'Bilirubin present - RBC destruction'),
    ('Mito EMF', ARRAY['Mitochondrial EMF'], 'environmental', 'EMF skin issues - hands/feet'),
    ('EMF NS', ARRAY[]::TEXT[], 'environmental', 'Post-flight radiation'),
    ('EMF Immune', ARRAY['EMF Immunity'], 'environmental', 'Chronic EMF worker - builds tolerance'),
    ('Deuterium', ARRAY['Deuterium experimental'], 'experimental', 'High deuterium >130 ppm - cancer risk'),

    -- Condition protocol frequencies
    ('Thyroiden', ARRAY['Thyroiden (Innovita)'], 'supplement', 'Thyroid supplement - stimulates hormone production'),
    ('MitoKond', ARRAY['MitoKond (Innovita)', 'MIT Con'], 'supplement', 'Mitochondrial support supplement'),
    ('Kidney Clear', ARRAY['Kidney Clear (Innovita)'], 'supplement', 'Kidney clearing supplement'),
    ('Autoimmune', ARRAY[]::TEXT[], 'immune', 'Autoimmune protocol frequency')
ON CONFLICT (name) DO UPDATE SET
    aliases = EXCLUDED.aliases,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    updated_at = NOW();

-- ============================================
-- SUCCESS
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'Migration complete: Added master_reference category and updated prioritized search with Phase 0';
END $$;
