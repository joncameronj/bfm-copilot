-- ============================================
-- Document Tags Seed Data
-- ============================================
-- Tags for categorizing documents by condition, symptom, and lab markers.
-- These enable smart search and condition cross-referencing.
-- ============================================

-- ============================================
-- Body System Tags
-- ============================================
INSERT INTO public.document_tags (tag_name, tag_type, display_name, description) VALUES
    ('endocrine', 'body_system', 'Endocrine System', 'Thyroid, adrenal, pancreas, pituitary, hormones'),
    ('cardiovascular', 'body_system', 'Cardiovascular System', 'Heart, blood vessels, circulation'),
    ('digestive', 'body_system', 'Digestive System', 'GI tract, liver, pancreas, gut health'),
    ('immune', 'body_system', 'Immune System', 'Immune function, autoimmunity, inflammation'),
    ('nervous', 'body_system', 'Nervous System', 'Brain, nerves, cognitive function'),
    ('musculoskeletal', 'body_system', 'Musculoskeletal System', 'Bones, muscles, joints'),
    ('reproductive', 'body_system', 'Reproductive System', 'Hormones, fertility, menopause'),
    ('respiratory', 'body_system', 'Respiratory System', 'Lungs, airways, breathing'),
    ('integumentary', 'body_system', 'Integumentary System', 'Skin, hair, nails'),
    ('urinary', 'body_system', 'Urinary System', 'Kidneys, bladder, urinary tract'),
    ('lymphatic', 'body_system', 'Lymphatic System', 'Lymph nodes, spleen, immune transport')
ON CONFLICT (tag_name) DO NOTHING;

-- ============================================
-- Condition Tags - Endocrine
-- ============================================
INSERT INTO public.document_tags (tag_name, tag_type, display_name, description) VALUES
    ('hypothyroidism', 'condition', 'Hypothyroidism', 'Underactive thyroid, low thyroid function'),
    ('hyperthyroidism', 'condition', 'Hyperthyroidism', 'Overactive thyroid, elevated thyroid function'),
    ('hashimotos', 'condition', 'Hashimoto''s Thyroiditis', 'Autoimmune thyroid condition'),
    ('graves_disease', 'condition', 'Graves'' Disease', 'Autoimmune hyperthyroidism'),
    ('adrenal_fatigue', 'condition', 'Adrenal Fatigue', 'HPA axis dysfunction, adrenal insufficiency'),
    ('adrenal_insufficiency', 'condition', 'Adrenal Insufficiency', 'Addison''s disease, low cortisol'),
    ('cushings', 'condition', 'Cushing''s Syndrome', 'Excess cortisol production'),
    ('diabetes_type2', 'condition', 'Type 2 Diabetes', 'Insulin resistance, elevated blood sugar'),
    ('prediabetes', 'condition', 'Prediabetes', 'Impaired glucose tolerance'),
    ('insulin_resistance', 'condition', 'Insulin Resistance', 'Metabolic syndrome, impaired insulin signaling'),
    ('pcos', 'condition', 'PCOS', 'Polycystic ovary syndrome'),
    ('low_testosterone', 'condition', 'Low Testosterone', 'Hypogonadism, andropause'),
    ('estrogen_dominance', 'condition', 'Estrogen Dominance', 'Elevated estrogen relative to progesterone')
ON CONFLICT (tag_name) DO NOTHING;

-- ============================================
-- Condition Tags - Cardiovascular
-- ============================================
INSERT INTO public.document_tags (tag_name, tag_type, display_name, description) VALUES
    ('hypertension', 'condition', 'Hypertension', 'High blood pressure'),
    ('hypotension', 'condition', 'Hypotension', 'Low blood pressure'),
    ('hyperlipidemia', 'condition', 'Hyperlipidemia', 'Elevated cholesterol and triglycerides'),
    ('atherosclerosis', 'condition', 'Atherosclerosis', 'Arterial plaque buildup'),
    ('heart_disease', 'condition', 'Heart Disease', 'Cardiovascular disease, CAD'),
    ('arrhythmia', 'condition', 'Arrhythmia', 'Irregular heartbeat'),
    ('anemia', 'condition', 'Anemia', 'Low red blood cells or hemoglobin'),
    ('iron_deficiency', 'condition', 'Iron Deficiency', 'Low iron, ferritin deficiency')
ON CONFLICT (tag_name) DO NOTHING;

-- ============================================
-- Condition Tags - Digestive/GI
-- ============================================
INSERT INTO public.document_tags (tag_name, tag_type, display_name, description) VALUES
    ('ibs', 'condition', 'IBS', 'Irritable bowel syndrome'),
    ('ibd', 'condition', 'IBD', 'Inflammatory bowel disease, Crohn''s, UC'),
    ('sibo', 'condition', 'SIBO', 'Small intestinal bacterial overgrowth'),
    ('leaky_gut', 'condition', 'Leaky Gut', 'Intestinal permeability'),
    ('gerd', 'condition', 'GERD', 'Gastroesophageal reflux disease'),
    ('fatty_liver', 'condition', 'Fatty Liver', 'NAFLD, hepatic steatosis'),
    ('gallbladder_disease', 'condition', 'Gallbladder Disease', 'Gallstones, biliary dysfunction'),
    ('h_pylori', 'condition', 'H. Pylori', 'Helicobacter pylori infection'),
    ('candida', 'condition', 'Candida Overgrowth', 'Yeast overgrowth, candidiasis'),
    ('food_sensitivities', 'condition', 'Food Sensitivities', 'Food intolerances, allergies')
ON CONFLICT (tag_name) DO NOTHING;

-- ============================================
-- Condition Tags - Immune/Autoimmune
-- ============================================
INSERT INTO public.document_tags (tag_name, tag_type, display_name, description) VALUES
    ('autoimmune', 'condition', 'Autoimmune Disease', 'General autoimmune conditions'),
    ('chronic_inflammation', 'condition', 'Chronic Inflammation', 'Systemic inflammation'),
    ('rheumatoid_arthritis', 'condition', 'Rheumatoid Arthritis', 'Autoimmune joint inflammation'),
    ('lupus', 'condition', 'Lupus', 'Systemic lupus erythematosus'),
    ('multiple_sclerosis', 'condition', 'Multiple Sclerosis', 'MS, CNS autoimmune'),
    ('mold_toxicity', 'condition', 'Mold Toxicity', 'CIRS, mycotoxin illness'),
    ('lyme_disease', 'condition', 'Lyme Disease', 'Borrelia infection, tick-borne illness'),
    ('epstein_barr', 'condition', 'Epstein-Barr Virus', 'EBV, chronic EBV reactivation')
ON CONFLICT (tag_name) DO NOTHING;

-- ============================================
-- Condition Tags - Mental/Neurological
-- ============================================
INSERT INTO public.document_tags (tag_name, tag_type, display_name, description) VALUES
    ('depression', 'condition', 'Depression', 'Major depressive disorder, low mood'),
    ('anxiety', 'condition', 'Anxiety', 'Anxiety disorder, generalized anxiety'),
    ('brain_fog', 'condition', 'Brain Fog', 'Cognitive dysfunction, mental clarity issues'),
    ('insomnia', 'condition', 'Insomnia', 'Sleep disorders, difficulty sleeping'),
    ('chronic_fatigue', 'condition', 'Chronic Fatigue', 'CFS, ME/CFS, persistent fatigue'),
    ('fibromyalgia', 'condition', 'Fibromyalgia', 'Chronic pain syndrome'),
    ('neuropathy', 'condition', 'Neuropathy', 'Peripheral neuropathy, nerve damage')
ON CONFLICT (tag_name) DO NOTHING;

-- ============================================
-- Condition Tags - Other
-- ============================================
INSERT INTO public.document_tags (tag_name, tag_type, display_name, description) VALUES
    ('vitamin_d_deficiency', 'condition', 'Vitamin D Deficiency', 'Low vitamin D levels'),
    ('b12_deficiency', 'condition', 'B12 Deficiency', 'Low vitamin B12'),
    ('magnesium_deficiency', 'condition', 'Magnesium Deficiency', 'Low magnesium levels'),
    ('osteoporosis', 'condition', 'Osteoporosis', 'Bone density loss'),
    ('obesity', 'condition', 'Obesity', 'Excess body weight, metabolic obesity'),
    ('metabolic_syndrome', 'condition', 'Metabolic Syndrome', 'Insulin resistance cluster')
ON CONFLICT (tag_name) DO NOTHING;

-- ============================================
-- Symptom Tags
-- ============================================
INSERT INTO public.document_tags (tag_name, tag_type, display_name, description) VALUES
    ('fatigue', 'symptom', 'Fatigue', 'Tiredness, low energy'),
    ('weight_gain', 'symptom', 'Weight Gain', 'Unexplained weight increase'),
    ('weight_loss', 'symptom', 'Weight Loss', 'Unexplained weight decrease'),
    ('hair_loss', 'symptom', 'Hair Loss', 'Alopecia, thinning hair'),
    ('cold_intolerance', 'symptom', 'Cold Intolerance', 'Sensitivity to cold'),
    ('heat_intolerance', 'symptom', 'Heat Intolerance', 'Sensitivity to heat'),
    ('constipation', 'symptom', 'Constipation', 'Infrequent bowel movements'),
    ('diarrhea', 'symptom', 'Diarrhea', 'Loose or frequent stools'),
    ('bloating', 'symptom', 'Bloating', 'Abdominal distension'),
    ('joint_pain', 'symptom', 'Joint Pain', 'Arthralgia'),
    ('muscle_pain', 'symptom', 'Muscle Pain', 'Myalgia'),
    ('headaches', 'symptom', 'Headaches', 'Head pain, migraines'),
    ('dizziness', 'symptom', 'Dizziness', 'Lightheadedness, vertigo'),
    ('palpitations', 'symptom', 'Palpitations', 'Heart racing, irregular heartbeat'),
    ('shortness_of_breath', 'symptom', 'Shortness of Breath', 'Dyspnea'),
    ('skin_issues', 'symptom', 'Skin Issues', 'Rashes, dryness, acne'),
    ('mood_changes', 'symptom', 'Mood Changes', 'Mood swings, irritability'),
    ('memory_issues', 'symptom', 'Memory Issues', 'Forgetfulness, cognitive decline'),
    ('low_libido', 'symptom', 'Low Libido', 'Decreased sex drive'),
    ('irregular_periods', 'symptom', 'Irregular Periods', 'Menstrual irregularities'),
    ('hot_flashes', 'symptom', 'Hot Flashes', 'Vasomotor symptoms'),
    ('night_sweats', 'symptom', 'Night Sweats', 'Nocturnal sweating')
ON CONFLICT (tag_name) DO NOTHING;

-- ============================================
-- Lab Marker Tags - Thyroid
-- ============================================
INSERT INTO public.document_tags (tag_name, tag_type, display_name, description) VALUES
    ('tsh', 'lab_marker', 'TSH', 'Thyroid stimulating hormone'),
    ('free_t4', 'lab_marker', 'Free T4', 'Free thyroxine'),
    ('free_t3', 'lab_marker', 'Free T3', 'Free triiodothyronine'),
    ('reverse_t3', 'lab_marker', 'Reverse T3', 'rT3, inactive thyroid hormone'),
    ('tpo_antibodies', 'lab_marker', 'TPO Antibodies', 'Thyroid peroxidase antibodies'),
    ('tg_antibodies', 'lab_marker', 'Thyroglobulin Antibodies', 'TgAb')
ON CONFLICT (tag_name) DO NOTHING;

-- ============================================
-- Lab Marker Tags - Metabolic
-- ============================================
INSERT INTO public.document_tags (tag_name, tag_type, display_name, description) VALUES
    ('glucose', 'lab_marker', 'Glucose', 'Fasting blood glucose'),
    ('hba1c', 'lab_marker', 'HbA1c', 'Hemoglobin A1c, glycated hemoglobin'),
    ('insulin', 'lab_marker', 'Insulin', 'Fasting insulin'),
    ('homa_ir', 'lab_marker', 'HOMA-IR', 'Insulin resistance index'),
    ('total_cholesterol', 'lab_marker', 'Total Cholesterol', 'Serum cholesterol'),
    ('ldl', 'lab_marker', 'LDL', 'Low-density lipoprotein'),
    ('hdl', 'lab_marker', 'HDL', 'High-density lipoprotein'),
    ('triglycerides', 'lab_marker', 'Triglycerides', 'Serum triglycerides'),
    ('vldl', 'lab_marker', 'VLDL', 'Very low-density lipoprotein'),
    ('apob', 'lab_marker', 'ApoB', 'Apolipoprotein B'),
    ('lpa', 'lab_marker', 'Lp(a)', 'Lipoprotein(a)')
ON CONFLICT (tag_name) DO NOTHING;

-- ============================================
-- Lab Marker Tags - Iron/Blood
-- ============================================
INSERT INTO public.document_tags (tag_name, tag_type, display_name, description) VALUES
    ('ferritin', 'lab_marker', 'Ferritin', 'Iron storage protein'),
    ('iron', 'lab_marker', 'Serum Iron', 'Blood iron level'),
    ('tibc', 'lab_marker', 'TIBC', 'Total iron binding capacity'),
    ('transferrin_saturation', 'lab_marker', 'Transferrin Saturation', 'Iron saturation percentage'),
    ('hemoglobin', 'lab_marker', 'Hemoglobin', 'Hgb'),
    ('hematocrit', 'lab_marker', 'Hematocrit', 'Hct'),
    ('rbc', 'lab_marker', 'RBC', 'Red blood cell count'),
    ('wbc', 'lab_marker', 'WBC', 'White blood cell count'),
    ('platelets', 'lab_marker', 'Platelets', 'Platelet count'),
    ('mcv', 'lab_marker', 'MCV', 'Mean corpuscular volume'),
    ('mch', 'lab_marker', 'MCH', 'Mean corpuscular hemoglobin'),
    ('mchc', 'lab_marker', 'MCHC', 'Mean corpuscular hemoglobin concentration')
ON CONFLICT (tag_name) DO NOTHING;

-- ============================================
-- Lab Marker Tags - Inflammation
-- ============================================
INSERT INTO public.document_tags (tag_name, tag_type, display_name, description) VALUES
    ('crp', 'lab_marker', 'CRP', 'C-reactive protein'),
    ('hscrp', 'lab_marker', 'hs-CRP', 'High-sensitivity CRP'),
    ('esr', 'lab_marker', 'ESR', 'Erythrocyte sedimentation rate'),
    ('homocysteine', 'lab_marker', 'Homocysteine', 'Amino acid marker'),
    ('fibrinogen', 'lab_marker', 'Fibrinogen', 'Clotting factor')
ON CONFLICT (tag_name) DO NOTHING;

-- ============================================
-- Lab Marker Tags - Hormones
-- ============================================
INSERT INTO public.document_tags (tag_name, tag_type, display_name, description) VALUES
    ('cortisol', 'lab_marker', 'Cortisol', 'Stress hormone'),
    ('dhea_s', 'lab_marker', 'DHEA-S', 'Dehydroepiandrosterone sulfate'),
    ('testosterone', 'lab_marker', 'Testosterone', 'Total testosterone'),
    ('free_testosterone', 'lab_marker', 'Free Testosterone', 'Bioavailable testosterone'),
    ('estradiol', 'lab_marker', 'Estradiol', 'E2, primary estrogen'),
    ('progesterone', 'lab_marker', 'Progesterone', 'Progestogen'),
    ('fsh', 'lab_marker', 'FSH', 'Follicle stimulating hormone'),
    ('lh', 'lab_marker', 'LH', 'Luteinizing hormone'),
    ('shbg', 'lab_marker', 'SHBG', 'Sex hormone binding globulin'),
    ('prolactin', 'lab_marker', 'Prolactin', 'PRL'),
    ('igf1', 'lab_marker', 'IGF-1', 'Insulin-like growth factor 1')
ON CONFLICT (tag_name) DO NOTHING;

-- ============================================
-- Lab Marker Tags - Vitamins/Minerals
-- ============================================
INSERT INTO public.document_tags (tag_name, tag_type, display_name, description) VALUES
    ('vitamin_d', 'lab_marker', 'Vitamin D', '25-hydroxyvitamin D'),
    ('vitamin_b12', 'lab_marker', 'Vitamin B12', 'Cobalamin'),
    ('folate', 'lab_marker', 'Folate', 'Folic acid, B9'),
    ('magnesium', 'lab_marker', 'Magnesium', 'RBC magnesium'),
    ('zinc', 'lab_marker', 'Zinc', 'Serum zinc'),
    ('selenium', 'lab_marker', 'Selenium', 'Serum selenium'),
    ('iodine', 'lab_marker', 'Iodine', 'Urine or serum iodine')
ON CONFLICT (tag_name) DO NOTHING;

-- ============================================
-- Lab Marker Tags - Liver/Kidney
-- ============================================
INSERT INTO public.document_tags (tag_name, tag_type, display_name, description) VALUES
    ('alt', 'lab_marker', 'ALT', 'Alanine aminotransferase'),
    ('ast', 'lab_marker', 'AST', 'Aspartate aminotransferase'),
    ('ggt', 'lab_marker', 'GGT', 'Gamma-glutamyl transferase'),
    ('alp', 'lab_marker', 'ALP', 'Alkaline phosphatase'),
    ('bilirubin', 'lab_marker', 'Bilirubin', 'Total bilirubin'),
    ('albumin', 'lab_marker', 'Albumin', 'Serum albumin'),
    ('total_protein', 'lab_marker', 'Total Protein', 'Serum protein'),
    ('bun', 'lab_marker', 'BUN', 'Blood urea nitrogen'),
    ('creatinine', 'lab_marker', 'Creatinine', 'Serum creatinine'),
    ('egfr', 'lab_marker', 'eGFR', 'Estimated glomerular filtration rate'),
    ('uric_acid', 'lab_marker', 'Uric Acid', 'Serum uric acid')
ON CONFLICT (tag_name) DO NOTHING;

-- ============================================
-- Treatment Tags
-- ============================================
INSERT INTO public.document_tags (tag_name, tag_type, display_name, description) VALUES
    ('levothyroxine', 'treatment', 'Levothyroxine', 'T4 thyroid hormone replacement'),
    ('liothyronine', 'treatment', 'Liothyronine', 'T3 thyroid hormone'),
    ('metformin', 'treatment', 'Metformin', 'Diabetes medication'),
    ('testosterone_therapy', 'treatment', 'Testosterone Therapy', 'TRT'),
    ('estrogen_therapy', 'treatment', 'Estrogen Therapy', 'HRT estrogen'),
    ('progesterone_therapy', 'treatment', 'Progesterone Therapy', 'HRT progesterone'),
    ('vitamin_d_supplementation', 'treatment', 'Vitamin D Supplementation', 'D3 supplementation'),
    ('iron_supplementation', 'treatment', 'Iron Supplementation', 'Ferrous sulfate, iron infusion'),
    ('b12_supplementation', 'treatment', 'B12 Supplementation', 'Methylcobalamin, cyanocobalamin'),
    ('probiotics', 'treatment', 'Probiotics', 'Gut bacteria supplementation'),
    ('elimination_diet', 'treatment', 'Elimination Diet', 'Food sensitivity protocol'),
    ('anti_inflammatory_diet', 'treatment', 'Anti-Inflammatory Diet', 'Dietary inflammation reduction'),
    ('adrenal_support', 'treatment', 'Adrenal Support', 'Adaptogen, cortisol modulation')
ON CONFLICT (tag_name) DO NOTHING;
