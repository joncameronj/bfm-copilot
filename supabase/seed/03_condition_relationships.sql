-- ============================================
-- Condition Relationships Seed Data
-- ============================================
-- Relationships between conditions for smart search expansion.
-- When a user asks about one condition, related conditions are also searched.
--
-- Relationship types:
-- - comorbidity: Conditions that commonly occur together
-- - contraindication: Conditions that may conflict with treatments
-- - underlying_cause: Condition A may cause or contribute to Condition B
-- - symptom_overlap: Conditions share similar symptoms
-- - treatment_interaction: Treatments for one affect the other
-- - differential_diagnosis: Conditions to rule out
--
-- Strength (0-1): How strongly related the conditions are
-- ============================================

-- Helper function to insert relationships by tag name
DO $$
DECLARE
    v_condition_id UUID;
    v_related_id UUID;
BEGIN
    -- ============================================
    -- Thyroid Relationships
    -- ============================================

    -- Hypothyroidism relationships
    SELECT id INTO v_condition_id FROM public.document_tags WHERE tag_name = 'hypothyroidism';

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'adrenal_fatigue';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'comorbidity', 0.7, 'Thyroid-adrenal axis dysfunction common')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'iron_deficiency';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'comorbidity', 0.6, 'Iron needed for thyroid hormone synthesis')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'vitamin_d_deficiency';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'comorbidity', 0.5, 'Often coexist, vitamin D supports thyroid')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'depression';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'symptom_overlap', 0.6, 'Low thyroid mimics depression symptoms')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'chronic_fatigue';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'symptom_overlap', 0.7, 'Fatigue is primary symptom of both')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'hashimotos';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'underlying_cause', 0.8, 'Hashimoto''s is leading cause of hypothyroidism')
    ON CONFLICT DO NOTHING;

    -- Hashimoto's relationships
    SELECT id INTO v_condition_id FROM public.document_tags WHERE tag_name = 'hashimotos';

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'autoimmune';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'comorbidity', 0.8, 'Often have multiple autoimmune conditions')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'leaky_gut';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'underlying_cause', 0.6, 'Gut permeability triggers autoimmunity')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'food_sensitivities';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'comorbidity', 0.6, 'Gluten sensitivity common with Hashimoto''s')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'selenium';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'treatment_interaction', 0.7, 'Selenium reduces TPO antibodies')
    ON CONFLICT DO NOTHING;

    -- ============================================
    -- Adrenal Relationships
    -- ============================================

    SELECT id INTO v_condition_id FROM public.document_tags WHERE tag_name = 'adrenal_fatigue';

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'chronic_fatigue';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'symptom_overlap', 0.8, 'Both present with persistent fatigue')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'insomnia';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'symptom_overlap', 0.6, 'Cortisol dysregulation affects sleep')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'anxiety';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'symptom_overlap', 0.6, 'Cortisol imbalance causes anxiety')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'low_testosterone';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'comorbidity', 0.5, 'DHEA/cortisol affects testosterone production')
    ON CONFLICT DO NOTHING;

    -- ============================================
    -- Iron Deficiency Relationships
    -- ============================================

    SELECT id INTO v_condition_id FROM public.document_tags WHERE tag_name = 'iron_deficiency';

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'anemia';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'underlying_cause', 0.9, 'Iron deficiency is leading cause of anemia')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'chronic_fatigue';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'underlying_cause', 0.7, 'Low ferritin causes fatigue even without anemia')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'hair_loss';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'underlying_cause', 0.6, 'Low ferritin contributes to hair loss')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'brain_fog';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'symptom_overlap', 0.5, 'Iron needed for cognitive function')
    ON CONFLICT DO NOTHING;

    -- ============================================
    -- Insulin Resistance / Metabolic Relationships
    -- ============================================

    SELECT id INTO v_condition_id FROM public.document_tags WHERE tag_name = 'insulin_resistance';

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'pcos';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'comorbidity', 0.8, 'PCOS strongly associated with insulin resistance')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'obesity';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'comorbidity', 0.7, 'Obesity and IR create vicious cycle')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'fatty_liver';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'comorbidity', 0.7, 'NAFLD strongly associated with IR')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'hyperlipidemia';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'comorbidity', 0.6, 'IR affects lipid metabolism')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'hypertension';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'comorbidity', 0.6, 'Part of metabolic syndrome')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'chronic_inflammation';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'comorbidity', 0.7, 'Inflammation drives IR and vice versa')
    ON CONFLICT DO NOTHING;

    -- ============================================
    -- PCOS Relationships
    -- ============================================

    SELECT id INTO v_condition_id FROM public.document_tags WHERE tag_name = 'pcos';

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'estrogen_dominance';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'comorbidity', 0.6, 'Hormone imbalance in PCOS')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'irregular_periods';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'symptom_overlap', 0.9, 'Core diagnostic criterion')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'hair_loss';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'symptom_overlap', 0.5, 'Androgenic alopecia in PCOS')
    ON CONFLICT DO NOTHING;

    -- ============================================
    -- Gut/Digestive Relationships
    -- ============================================

    SELECT id INTO v_condition_id FROM public.document_tags WHERE tag_name = 'leaky_gut';

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'autoimmune';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'underlying_cause', 0.7, 'Gut permeability triggers autoimmunity')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'food_sensitivities';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'comorbidity', 0.8, 'Intestinal permeability causes sensitivities')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'chronic_inflammation';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'underlying_cause', 0.7, 'Gut inflammation becomes systemic')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_condition_id FROM public.document_tags WHERE tag_name = 'sibo';

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'ibs';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'underlying_cause', 0.7, 'SIBO is common cause of IBS symptoms')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'bloating';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'symptom_overlap', 0.9, 'Primary symptom of SIBO')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'b12_deficiency';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'underlying_cause', 0.5, 'SIBO can cause B12 malabsorption')
    ON CONFLICT DO NOTHING;

    -- ============================================
    -- Mold/Toxin Relationships
    -- ============================================

    SELECT id INTO v_condition_id FROM public.document_tags WHERE tag_name = 'mold_toxicity';

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'chronic_fatigue';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'symptom_overlap', 0.8, 'Fatigue is hallmark of CIRS')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'brain_fog';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'symptom_overlap', 0.8, 'Cognitive dysfunction common in CIRS')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'chronic_inflammation';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'underlying_cause', 0.8, 'Mycotoxins trigger inflammatory cascade')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'autoimmune';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'underlying_cause', 0.5, 'Mold exposure can trigger autoimmunity')
    ON CONFLICT DO NOTHING;

    -- ============================================
    -- Depression/Anxiety Relationships
    -- ============================================

    SELECT id INTO v_condition_id FROM public.document_tags WHERE tag_name = 'depression';

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'chronic_inflammation';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'underlying_cause', 0.6, 'Inflammation linked to depression')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'vitamin_d_deficiency';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'underlying_cause', 0.5, 'Low vitamin D associated with depression')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'anxiety';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'comorbidity', 0.7, 'Anxiety and depression often coexist')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'insomnia';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'comorbidity', 0.6, 'Sleep disturbance common with depression')
    ON CONFLICT DO NOTHING;

    -- ============================================
    -- Vitamin D Deficiency Relationships
    -- ============================================

    SELECT id INTO v_condition_id FROM public.document_tags WHERE tag_name = 'vitamin_d_deficiency';

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'osteoporosis';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'underlying_cause', 0.7, 'Vitamin D essential for bone health')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'autoimmune';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'comorbidity', 0.6, 'Vitamin D modulates immune function')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'chronic_fatigue';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'underlying_cause', 0.5, 'Low D levels contribute to fatigue')
    ON CONFLICT DO NOTHING;

    -- ============================================
    -- Chronic Fatigue Relationships
    -- ============================================

    SELECT id INTO v_condition_id FROM public.document_tags WHERE tag_name = 'chronic_fatigue';

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'fibromyalgia';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'comorbidity', 0.7, 'Often coexist, shared mechanisms')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'epstein_barr';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'underlying_cause', 0.6, 'EBV reactivation linked to CFS')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'lyme_disease';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'differential_diagnosis', 0.6, 'Chronic Lyme mimics CFS')
    ON CONFLICT DO NOTHING;

    -- ============================================
    -- Autoimmune General Relationships
    -- ============================================

    SELECT id INTO v_condition_id FROM public.document_tags WHERE tag_name = 'autoimmune';

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'chronic_inflammation';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'comorbidity', 0.9, 'Autoimmunity drives chronic inflammation')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_related_id FROM public.document_tags WHERE tag_name = 'leaky_gut';
    INSERT INTO public.condition_relationships (condition_tag_id, related_tag_id, relationship_type, strength, notes)
    VALUES (v_condition_id, v_related_id, 'underlying_cause', 0.7, 'Gut permeability triggers autoimmunity')
    ON CONFLICT DO NOTHING;

END $$;
