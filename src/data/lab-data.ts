import type { LabMarker, EvaluationRule, OminousMarker, LabCategory } from '@/types/labs';

// ============================================
// LAB MARKERS - All 80+ markers organized by category
// ============================================
export const labMarkers: LabMarker[] = [
  // CARDIAC FUNCTION
  {
    id: 'nt-probnp',
    name: 'NT-proBNP',
    displayName: 'NT-proBNP',
    category: 'cardiac',
    unit: 'pg/mL',
    description: 'Used to help detect, diagnose, and evaluate the severity of congestive heart failure. Peptide released in response to cardiac wall stress or stretch.',
    displayOrder: 1,
    targetRange: '<125',
  },

  // INFLAMMATION
  {
    id: 'crp',
    name: 'CRP',
    displayName: 'CRP (C-reactive protein)',
    category: 'inflammation',
    unit: 'mg/L',
    description: 'Acute phase inflammatory reactant made in the liver. Early marker for cellular inflammation. Involved with Leptin Resistance.',
    displayOrder: 1,
    targetRange: '<1.0',
  },
  {
    id: 'homocysteine',
    name: 'Homocysteine',
    displayName: 'Homocysteine',
    category: 'inflammation',
    unit: 'µmol/L',
    description: 'Byproduct of methionine production, Methylation status marker. Inflammatory if high.',
    displayOrder: 2,
    targetRange: '5 - 9',
  },
  {
    id: 'uric-acid-male',
    name: 'Uric Acid (Male)',
    displayName: 'Uric Acid',
    category: 'inflammation',
    unit: 'mg/dL',
    description: 'Breakdown product of purine protein to be removed during excretion.',
    displayOrder: 3,
    targetRange: '3.7 - 6.0',
    gender: 'male',
  },
  {
    id: 'uric-acid-female',
    name: 'Uric Acid (Female)',
    displayName: 'Uric Acid',
    category: 'inflammation',
    unit: 'mg/dL',
    description: 'Breakdown product of purine protein to be removed during excretion.',
    displayOrder: 4,
    targetRange: '3.2 - 5.5',
    gender: 'female',
  },

  // ANEMIA
  {
    id: 'iron',
    name: 'Iron',
    displayName: 'Iron',
    category: 'anemia',
    unit: 'µg/dL',
    description: 'Measures the circulating Iron in the blood that is attached to transferrin. Involved in oxygen transport, cellular respiration.',
    displayOrder: 1,
    targetRange: '85 - 130',
  },
  {
    id: 'uibc',
    name: 'UIBC',
    displayName: 'UIBC',
    category: 'anemia',
    unit: 'µg/dL',
    description: 'About 1/3rd of your blood\'s transferrin is always working to transport iron. That leaves extra iron-binding capacity known as UIBC.',
    displayOrder: 2,
    targetRange: '150 - 350',
  },
  {
    id: 'tibc',
    name: 'TIBC',
    displayName: 'TIBC',
    category: 'anemia',
    unit: 'µg/dL',
    description: 'Measures the body\'s ability to bind iron with transferrin.',
    displayOrder: 3,
    targetRange: '250 - 350',
  },
  {
    id: 'transferrin',
    name: 'Transferrin',
    displayName: 'Transferrin',
    category: 'anemia',
    unit: 'mg/dL',
    description: 'It compares the amount of iron in the blood stream to the capacity of the red blood cells to transport iron.',
    displayOrder: 4,
    targetRange: '200 - 360',
  },
  {
    id: 'transferrin-saturation',
    name: 'Transferrin Saturation (%)',
    displayName: 'Transferrin Saturation (%)',
    category: 'anemia',
    unit: '%',
    description: 'It compares the amount of iron in the blood to the capacity of the blood to transport iron in percentage.',
    displayOrder: 5,
    targetRange: '12 - 45',
  },
  {
    id: 'vitamin-b12',
    name: 'Vitamin B12',
    displayName: 'Vitamin B12',
    category: 'anemia',
    unit: 'pg/mL',
    description: 'Key role in normal functioning of brain, nervous system and red blood cell formation and blood oxygenation.',
    displayOrder: 6,
    targetRange: '200 - 1000',
  },
  {
    id: 'folate',
    name: 'Folate',
    displayName: 'Folate',
    category: 'anemia',
    unit: 'ng/mL',
    description: 'Vitamin B9, key player in Methylation and prevention of cancers and cognitive disorders. Formation of red blood cells and DNA.',
    displayOrder: 7,
    targetRange: '4.6 - 9.0',
  },
  {
    id: 'ferritin-male',
    name: 'Ferritin (Male)',
    displayName: 'Ferritin',
    category: 'anemia',
    unit: 'ng/mL',
    description: 'The most sensitive test to detect iron deficiency. Main storage form of iron in the body.',
    displayOrder: 8,
    targetRange: '20 - 100',
    gender: 'male',
  },
  {
    id: 'ferritin-female',
    name: 'Ferritin (Female)',
    displayName: 'Ferritin',
    category: 'anemia',
    unit: 'ng/mL',
    description: 'The most sensitive test to detect iron deficiency. Main storage form of iron in the body.',
    displayOrder: 9,
    targetRange: '20 - 80',
    gender: 'female',
  },

  // LIPIDS
  {
    id: 'total-cholesterol-male-18-34',
    name: 'Total Cholesterol (Male 18-34 yrs old)',
    displayName: 'Total Cholesterol',
    category: 'lipids',
    unit: 'mg/dL',
    description: 'Fats that are made into hormones, enzymes & antibodies, lining of arterial walls and vitamin D. Make up 60% of brain tissue.',
    displayOrder: 1,
    targetRange: '180 - 220',
    gender: 'male',
    ageMin: 18,
    ageMax: 34,
  },
  {
    id: 'total-cholesterol-male-35-plus',
    name: 'Total Cholesterol (Male 35 yrs old & above)',
    displayName: 'Total Cholesterol',
    category: 'lipids',
    unit: 'mg/dL',
    description: 'Fats that are made into hormones, enzymes & antibodies, lining of arterial walls and vitamin D. Make up 60% of brain tissue.',
    displayOrder: 2,
    targetRange: '210 - 249',
    gender: 'male',
    ageMin: 35,
    ageMax: 150,
  },
  {
    id: 'total-cholesterol-female-18-34',
    name: 'Total Cholesterol (Female 18-34 yrs old)',
    displayName: 'Total Cholesterol',
    category: 'lipids',
    unit: 'mg/dL',
    description: 'Fats that are made into hormones, enzymes & antibodies, lining of arterial walls and vitamin D. Make up 60% of brain tissue.',
    displayOrder: 3,
    targetRange: '160 - 199',
    gender: 'female',
    ageMin: 18,
    ageMax: 34,
  },
  {
    id: 'total-cholesterol-female-35-44',
    name: 'Total Cholesterol (Female 35-44 yrs old)',
    displayName: 'Total Cholesterol',
    category: 'lipids',
    unit: 'mg/dL',
    description: 'Fats that are made into hormones, enzymes & antibodies, lining of arterial walls and vitamin D. Make up 60% of brain tissue.',
    displayOrder: 4,
    targetRange: '180 - 220',
    gender: 'female',
    ageMin: 35,
    ageMax: 44,
  },
  {
    id: 'total-cholesterol-female-45-plus',
    name: 'Total Cholesterol (Female 45 yrs old & above)',
    displayName: 'Total Cholesterol',
    category: 'lipids',
    unit: 'mg/dL',
    description: 'Fats that are made into hormones, enzymes & antibodies, lining of arterial walls and vitamin D. Make up 60% of brain tissue.',
    displayOrder: 5,
    targetRange: '210 - 249',
    gender: 'female',
    ageMin: 45,
    ageMax: 150,
  },
  {
    id: 'triglycerides',
    name: 'Triglycerides',
    displayName: 'Triglycerides',
    category: 'lipids',
    unit: 'mg/dL',
    description: 'Are major building blocks of very low density lipoproteins (VLDL) and play an important role in metabolism as energy sources.',
    displayOrder: 6,
    targetRange: '75 - 100',
  },
  {
    id: 'hdl-cholesterol',
    name: 'HDL Cholesterol',
    displayName: 'HDL "Good" Cholesterol',
    category: 'lipids',
    unit: 'mg/dL',
    description: 'The "good" cholesterol, it carries cholesterol away from your arteries to your liver.',
    displayOrder: 7,
    targetRange: '56 - 79',
  },
  {
    id: 'tg-hdl-ratio',
    name: 'Triglyceride/HDL Ratio',
    displayName: 'Triglyceride / HDL ratio',
    category: 'lipids',
    unit: null,
    description: 'Triglyceride / HDL (TG / HDL) ratio is a calculated measure that can help assess your risk of heart disease and metabolic syndrome.',
    displayOrder: 8,
    targetRange: '2.0',
  },
  {
    id: 'ldl-cholesterol-under-35',
    name: 'LDL Cholesterol (under 35 yrs old)',
    displayName: 'LDL Cholesterol',
    category: 'lipids',
    unit: 'mg/dL',
    description: 'The "bad" cholesterol, responsible for plaque build-up in the arteries. Stabilizes the inner mitochondrial membrane during heavy cellular energy production.',
    displayOrder: 9,
    targetRange: '<120',
    ageMin: 0,
    ageMax: 34,
  },
  {
    id: 'ldl-cholesterol-35-plus',
    name: 'LDL Cholesterol (35 yrs old & above)',
    displayName: 'LDL Cholesterol',
    category: 'lipids',
    unit: 'mg/dL',
    description: 'The "bad" cholesterol, responsible for plaque build-up in the arteries. Stabilizes the inner mitochondrial membrane during heavy cellular energy production.',
    displayOrder: 10,
    targetRange: '120 - 150',
    ageMin: 35,
    ageMax: 150,
  },
  {
    id: 'sdldl',
    name: 'sdLDL',
    displayName: 'sdLDL',
    category: 'lipids',
    unit: 'mg/dL',
    description: 'Small dense LDL, stays in circulation longer, more easily oxidized and can invade arterial walls easier.',
    displayOrder: 11,
    targetRange: '<30',
  },
  {
    id: 'apo-a1',
    name: 'Apo A-1',
    displayName: 'Apo A-1',
    category: 'lipids',
    unit: 'mg/dL',
    description: 'Mediates reverse cholesterol transport by returning excess cholesterol from peripheral tissue to the liver.',
    displayOrder: 12,
    targetRange: '108 - 225',
  },
  {
    id: 'apo-b',
    name: 'Apo B',
    displayName: 'Apo B',
    category: 'lipids',
    unit: 'mg/dL',
    description: 'Considered a direct measure of atherogenic lipoproteins.',
    displayOrder: 13,
    targetRange: '80 - 100',
  },
  {
    id: 'lpa',
    name: 'Lp(a)',
    displayName: 'Lp(a)',
    category: 'lipids',
    unit: 'nmol/L',
    description: 'Most powerful genetic risk factor for cardiovascular disease.',
    displayOrder: 14,
    targetRange: '<30',
  },
  {
    id: 'total-creatine',
    name: 'Total Creatine',
    displayName: 'Total Creatine',
    category: 'lipids',
    unit: 'mg/dL',
    description: 'Enzyme chiefly found in the brain, skeletal muscles, and heart. Functions in cellular energy metabolism.',
    displayOrder: 15,
    targetRange: '0.7 - 1.1',
  },

  // DIABETES & WEIGHT MANAGEMENT
  {
    id: 'glucose',
    name: 'Glucose',
    displayName: 'Glucose',
    category: 'diabetes',
    unit: 'mg/dL',
    description: 'The body\'s chief source of energy. It affects all organs, systems and tissues. It helps determine the acid/alkaline balance (pH).',
    displayOrder: 1,
    targetRange: '85 - 100',
  },
  {
    id: 'insulin',
    name: 'Insulin',
    displayName: 'Insulin',
    category: 'diabetes',
    unit: 'µIU/mL',
    description: 'Hormone from the pancreas that acts to take sugar out the blood stream and enter it into cells for energy production.',
    displayOrder: 2,
    targetRange: '3 - 9',
  },
  {
    id: 'hba1c',
    name: 'HbA1C',
    displayName: 'HbA1C',
    category: 'diabetes',
    unit: '%',
    description: 'Measures blood glucose that has attached itself to hemoglobin. This test more accurately measures glucose levels over the two-three weeks prior.',
    displayOrder: 3,
    targetRange: '4.8 - 5.4',
  },
  {
    id: 'adiponectin',
    name: 'Adiponectin',
    displayName: 'Adiponectin',
    category: 'diabetes',
    unit: 'µg/mL',
    description: 'Regulates glucose and fatty acid breakdown.',
    displayOrder: 4,
    targetRange: '7 - 24.2',
  },
  {
    id: 'leptin',
    name: 'Leptin',
    displayName: 'Leptin',
    category: 'diabetes',
    unit: 'ng/mL',
    description: 'Hormone secreted from fat and nerve cells to signal to the brain satiety. Involved in keeping energy balances between the brain and body.',
    displayOrder: 5,
    targetRange: '<20',
  },
  {
    id: 'msh',
    name: 'MSH',
    displayName: 'MSH',
    category: 'diabetes',
    unit: 'pg/mL',
    description: 'Helps your skin tan, Increase endorphins, Needed for gut integrity, kills staph and candida, Insulin sensitivity, collagen production, needed for thyroid function.',
    displayOrder: 6,
    targetRange: '>20',
  },

  // CALCIUM, BONE & MINERAL HEALTH
  {
    id: 'calcium',
    name: 'Calcium',
    displayName: 'Calcium',
    category: 'bone_mineral',
    unit: 'mg/dL',
    description: 'About bone metabolism: the most important element in the body. Maintains cardiac regularity & is required for muscle relaxation & contraction.',
    displayOrder: 1,
    targetRange: '9.5 - 10',
  },
  {
    id: 'albumin',
    name: 'Albumin',
    displayName: 'Albumin',
    category: 'bone_mineral',
    unit: 'g/dL',
    description: 'Albumin is a major constituent of blood proteins. It is produced mainly in the liver, playing a major role in distributing water and serving as a transport protein.',
    displayOrder: 2,
    targetRange: '4 - 5',
  },
  {
    id: 'parathyroid-hormone',
    name: 'Parathyroid Hormone',
    displayName: 'Parathyroid Hormone',
    category: 'bone_mineral',
    unit: 'pg/mL',
    description: 'Secreted by the parathyroid and involved in bone metabolism and calcium homeostasis.',
    displayOrder: 3,
    targetRange: '15 - 65',
  },
  {
    id: 'vitamin-d',
    name: '25-HYDROXY Vitamin D',
    displayName: '25-HYDROXY Vitamin D',
    category: 'bone_mineral',
    unit: 'ng/mL',
    description: 'Use to diagnose vitamin D insufficiency and proxy for UV light exposure. Controls the level of phosphate and calcium in blood.',
    displayOrder: 4,
    targetRange: '>44',
  },
  {
    id: 'magnesium',
    name: 'Magnesium',
    displayName: 'Magnesium',
    category: 'bone_mineral',
    unit: 'mg/dL',
    description: 'Important for many different enzymatic reactions such as carbohydrate metabolism, protein synthesis, nucleic acid synthesis, muscular contraction.',
    displayOrder: 5,
    targetRange: '2.0 - 2.5',
  },

  // RENAL
  {
    id: 'sodium',
    name: 'Sodium',
    displayName: 'Sodium',
    category: 'renal',
    unit: 'mEq/L',
    description: 'Sodium constitutes 90% of the electrolyte fluid facilitating cellular transport. Essential to acid-base balance and intra/extra cellular fluid exchanges.',
    displayOrder: 1,
    targetRange: '135 - 140',
  },
  {
    id: 'potassium',
    name: 'Potassium',
    displayName: 'Potassium',
    category: 'renal',
    unit: 'mEq/L',
    description: 'Essential to heart & kidney function and the maintenance of pH of both blood & urine. It maintains regular heart rate and muscle force.',
    displayOrder: 2,
    targetRange: '4.0 - 4.5',
  },
  {
    id: 'chloride',
    name: 'Chloride',
    displayName: 'Chloride',
    category: 'renal',
    unit: 'mEq/L',
    description: 'Indicates kidney, bladder, and bowel function. Essential for electrolyte balance and pH maintenance.',
    displayOrder: 3,
    targetRange: '100 - 106',
  },
  {
    id: 'carbon-dioxide',
    name: 'Carbon Dioxide',
    displayName: 'Carbon Dioxide',
    category: 'renal',
    unit: 'mEq/L',
    description: 'Bicarbonate is a vital component of controlling the pH of the body. Byproduct of mitochondria energy production using oxygen.',
    displayOrder: 4,
    targetRange: '25 - 30',
  },
  {
    id: 'bun',
    name: 'BUN',
    displayName: 'BUN',
    category: 'renal',
    unit: 'mg/dL',
    description: 'Reflects the ratio between the production and clearance of urea. Reveals the degree of toxicity of protein to the kidneys.',
    displayOrder: 5,
    targetRange: '13 - 18',
  },
  {
    id: 'total-protein',
    name: 'Total Protein',
    displayName: 'Total Protein',
    category: 'renal',
    unit: 'g/dL',
    description: 'Necessary for tissue function, growth, & repair. Fluid balance, protection against infection. Key building block of the human body.',
    displayOrder: 6,
    targetRange: '6.9 - 7.4',
  },
  {
    id: 'creatinine',
    name: 'Creatinine',
    displayName: 'Creatinine',
    category: 'renal',
    unit: 'mg/dL',
    description: 'A waste product produced by muscles, which is removed by the kidneys. Also related to the methylation system.',
    displayOrder: 7,
    targetRange: '0.5 - 0.9',
  },
  {
    id: 'cystatin-c',
    name: 'Cystatin C',
    displayName: 'Cystatin C',
    category: 'renal',
    unit: 'mg/L',
    description: 'Biomarker of kidney function.',
    displayOrder: 8,
    targetRange: '<= 0.95',
  },
  {
    id: 'egfr',
    name: 'eGFR',
    displayName: 'eGFR',
    category: 'renal',
    unit: 'mL/min/1.73m²',
    description: 'Used to screen for and detect early kidney damage, to help diagnose kidney disease, and monitor kidney status.',
    displayOrder: 9,
    targetRange: '>89',
  },
  {
    id: 'bun-creatinine-ratio',
    name: 'BUN/Creatinine Ratio',
    displayName: 'BUN/Creatinine Ratio',
    category: 'renal',
    unit: null,
    description: 'Relates to kidney removal of water, protein, and tissue residue. Mitochondrial production of EZ water.',
    displayOrder: 10,
    targetRange: '10 - 16',
  },

  // HEPATIC
  {
    id: 'alt',
    name: 'ALT',
    displayName: 'ALT (GPT)',
    category: 'hepatic',
    unit: 'U/L',
    description: 'An enzyme associated with the liver, heart, and skeletal muscle.',
    displayOrder: 1,
    targetRange: '10 - 26',
  },
  {
    id: 'ast',
    name: 'AST',
    displayName: 'AST (GOT)',
    category: 'hepatic',
    unit: 'U/L',
    description: 'Relates to liver enzyme activity, kidney & skeletal muscle.',
    displayOrder: 2,
    targetRange: '10 - 26',
  },
  {
    id: 'ggt-male',
    name: 'Gamma GT (Male)',
    displayName: 'Gamma GT (GGT)',
    category: 'hepatic',
    unit: 'U/L',
    description: 'Liver damage, biliary obstruction of bile ducts. Low antioxidant levels, Accurate predictor of mortality. More dangerous if combined with high ferritin.',
    displayOrder: 3,
    targetRange: '<16',
    gender: 'male',
  },
  {
    id: 'ggt-female',
    name: 'Gamma GT (Female)',
    displayName: 'Gamma GT (GGT)',
    category: 'hepatic',
    unit: 'U/L',
    description: 'Liver damage, biliary obstruction of bile ducts. Low antioxidant levels, Accurate predictor of mortality. More dangerous if combined with high ferritin.',
    displayOrder: 4,
    targetRange: '<9',
    gender: 'female',
  },
  {
    id: 'alkaline-phosphatase',
    name: 'Alkaline Phosphatase',
    displayName: 'Alkaline Phosphatase',
    category: 'hepatic',
    unit: 'U/L',
    description: 'Refers to a group of isoenzymes that are found in the bone, liver, intestines, skin, and placenta. Indicates how the liver is utilizing protein and fats, and pH balance.',
    displayOrder: 5,
    targetRange: '70 - 100',
  },
  {
    id: 'total-bilirubin',
    name: 'Total Bilirubin',
    displayName: 'Total Bilirubin',
    category: 'hepatic',
    unit: 'mg/dL',
    description: 'Bilirubin is the end product of hemoglobin breakdown from red blood cells.',
    displayOrder: 6,
    targetRange: '0.2 - 1.2',
  },
  {
    id: 'direct-bilirubin',
    name: 'Direct Bilirubin',
    displayName: 'Direct Bilirubin',
    category: 'hepatic',
    unit: 'mg/dL',
    description: 'The most sensitive test for liver function/dysfunction.',
    displayOrder: 7,
    targetRange: '<0.3',
  },

  // THYROID
  {
    id: 'tsh',
    name: 'TSH',
    displayName: 'TSH',
    category: 'thyroid',
    unit: 'mIU/L',
    description: 'A pituitary gland hormone that stimulates the thyroid gland to secrete additional T4 and some T3.',
    displayOrder: 1,
    targetRange: '1.0 - 3.0',
  },
  {
    id: 't4-total',
    name: 'T4, Total',
    displayName: 'T4, TOTAL',
    category: 'thyroid',
    unit: 'µg/dL',
    description: 'Reflects the total output of the thyroid gland and actual T4 hormone released.',
    displayOrder: 2,
    targetRange: '6 - 12',
  },
  {
    id: 't4-free',
    name: 'T4, Free',
    displayName: 'T4, free',
    category: 'thyroid',
    unit: 'ng/dL',
    description: 'The measure of active T4 in the blood but, must be converted to T3 to impact metabolism.',
    displayOrder: 3,
    targetRange: '1.0 - 1.5',
  },
  {
    id: 't3-total',
    name: 'T3, Total',
    displayName: 'T3, TOTAL',
    category: 'thyroid',
    unit: 'ng/dL',
    description: 'T3 is the most active thyroid hormone which is largely protein–bound but not necessarily available for metabolic activity.',
    displayOrder: 4,
    targetRange: '60 - 180',
  },
  {
    id: 't3-free',
    name: 'T3, Free',
    displayName: 'T3, free',
    category: 'thyroid',
    unit: 'pg/mL',
    description: 'This test measures the free or active T3 hormone (unbound) levels, which is the actual hormones that culminates in an increase in metabolism and energy.',
    displayOrder: 5,
    targetRange: '3.5 - 4.5',
  },
  {
    id: 'tpo-ab',
    name: 'TPO AB',
    displayName: 'TPO AB',
    category: 'thyroid',
    unit: 'IU/mL',
    description: 'Check in cases of autoimmune thyroid disorders.',
    displayOrder: 6,
    targetRange: '0 - 34',
  },
  {
    id: 'tgb-ab',
    name: 'TGB AB',
    displayName: 'TGB AB',
    category: 'thyroid',
    unit: 'IU/mL',
    description: 'Check in cases of autoimmune thyroid disorders. This antibody is associated with thyroid cancer.',
    displayOrder: 7,
    targetRange: '0.0 - 0.9',
  },
  {
    id: 'reverse-t3-ratio',
    name: 'Reverse T3 Ratio',
    displayName: 'Reverse T3 Ratio to Free T3',
    category: 'thyroid',
    unit: null,
    description: 'Made by the liver in a stress response to either block T3 function or get rid of excess unneeded T4.',
    displayOrder: 8,
    targetRange: '>1.6',
  },

  // HORMONES
  {
    id: 'estradiol-male',
    name: 'Estradiol (Male)',
    displayName: 'Estradiol',
    category: 'hormones',
    unit: 'pg/mL',
    description: 'The biologically active form of estrogen. Good marker for ovary function.',
    displayOrder: 1,
    targetRange: '20 - 25',
    gender: 'male',
  },
  {
    id: 'estradiol-female',
    name: 'Estradiol (Female)',
    displayName: 'Estradiol',
    category: 'hormones',
    unit: 'pg/mL',
    description: 'The biologically active form of estrogen. Good marker for ovary function.',
    displayOrder: 2,
    targetRange: '25.8 - 60.7',
    gender: 'female',
  },
  {
    id: 'fsh',
    name: 'FSH',
    displayName: 'FSH',
    category: 'hormones',
    unit: 'mIU/mL',
    description: 'FSH is produced by the pituitary gland. LH and FSH together stimulate the growth and maturation of the follicle.',
    displayOrder: 3,
    targetRange: '1.4 - 12.5',
  },
  {
    id: 'dhea-s',
    name: 'DHEA-S',
    displayName: 'DHEA-S',
    category: 'hormones',
    unit: 'µg/dL',
    description: 'Steroid hormone produced by the adrenal glands that acts as an intermediary in the production of gender hormones.',
    displayOrder: 4,
    targetRange: '60.9 - 337.0',
  },
  {
    id: 'lh',
    name: 'LH',
    displayName: 'LH',
    category: 'hormones',
    unit: 'mIU/mL',
    description: 'LH is produced by the pituitary gland. LH and FSH together stimulate the growth and maturation of the follicle.',
    displayOrder: 5,
    targetRange: '1.7 - 8.6',
  },
  {
    id: 'shbg',
    name: 'SHBG',
    displayName: 'SHBG',
    category: 'hormones',
    unit: 'nmol/L',
    description: 'Protein produced by the liver that bonds to hormones in the periphery.',
    displayOrder: 6,
    targetRange: '16 - 55',
  },
  {
    id: 'testosterone-total',
    name: 'Testosterone, Total',
    displayName: 'Testosterone, Total',
    category: 'hormones',
    unit: 'ng/dL',
    description: 'Measure of testosterone in the system that is bound and unbound.',
    displayOrder: 7,
    targetRange: '249 - 836',
  },
  {
    id: 'free-testosterone',
    name: 'Free Testosterone',
    displayName: 'Free Testosterone',
    category: 'hormones',
    unit: 'pg/mL',
    description: 'Measure of testosterone that is unbound.',
    displayOrder: 8,
    targetRange: '9 - 30',
  },
  {
    id: 'progesterone',
    name: 'Progesterone',
    displayName: 'Progesterone',
    category: 'hormones',
    unit: 'ng/mL',
    description: 'Sex hormone involved in the menstrual cycle, pregnancy, and embryogenesis of humans and other species.',
    displayOrder: 9,
    targetRange: '0.2 - 1.4',
  },

  // CBC WITH DIFFERENTIAL
  {
    id: 'wbc',
    name: 'WBC',
    displayName: 'WBC',
    category: 'cbc',
    unit: 'K/µL',
    description: 'Leukocytes, found in bone marrow. Protects body against infection and inflammation.',
    displayOrder: 1,
    targetRange: '5.0 - 8.0',
  },
  {
    id: 'rbc-male',
    name: 'RBC (Male)',
    displayName: 'RBC',
    category: 'cbc',
    unit: 'M/µL',
    description: 'Erythrocytes, relates to anemia. Carries oxygen to the cells & carbon dioxide back to the lungs.',
    displayOrder: 2,
    targetRange: '4.2 - 4.9',
    gender: 'male',
  },
  {
    id: 'rbc-female',
    name: 'RBC (Female)',
    displayName: 'RBC',
    category: 'cbc',
    unit: 'M/µL',
    description: 'Erythrocytes, relates to anemia. Carries oxygen to the cells & carbon dioxide back to the lungs.',
    displayOrder: 3,
    targetRange: '3.9 - 4.4',
    gender: 'female',
  },
  {
    id: 'hemoglobin-male',
    name: 'Hemoglobin (Male)',
    displayName: 'Hemoglobin',
    category: 'cbc',
    unit: 'g/dL',
    description: 'Part of your red blood cells that transport oxygen and carbon dioxide. Related to the amount of intracellular iron.',
    displayOrder: 4,
    targetRange: '14 - 15',
    gender: 'male',
  },
  {
    id: 'hemoglobin-female',
    name: 'Hemoglobin (Female)',
    displayName: 'Hemoglobin',
    category: 'cbc',
    unit: 'g/dL',
    description: 'Part of your red blood cells that transport oxygen and carbon dioxide. Related to the amount of intracellular iron.',
    displayOrder: 5,
    targetRange: '13.5 - 14.5',
    gender: 'female',
  },
  {
    id: 'hematocrit-male',
    name: 'Hematocrit (Male)',
    displayName: 'Hematocrit',
    category: 'cbc',
    unit: '%',
    description: 'Percentage of red blood cells to whole blood (plasma). Relates to abnormal state of hydration, also the spleen.',
    displayOrder: 6,
    targetRange: '40 - 48',
    gender: 'male',
  },
  {
    id: 'hematocrit-female',
    name: 'Hematocrit (Female)',
    displayName: 'Hematocrit',
    category: 'cbc',
    unit: '%',
    description: 'Percentage of red blood cells to whole blood (plasma). Relates to abnormal state of hydration, also the spleen.',
    displayOrder: 7,
    targetRange: '37 - 44',
    gender: 'female',
  },
  {
    id: 'mcv',
    name: 'MCV',
    displayName: 'MCV',
    category: 'cbc',
    unit: 'fL',
    description: 'Measures the average size of red blood cells.',
    displayOrder: 8,
    targetRange: '85 - 92',
  },
  {
    id: 'mch',
    name: 'MCH',
    displayName: 'MCH',
    category: 'cbc',
    unit: 'pg',
    description: 'A hemoglobin-RBC ratio, measures the average amount of hemoglobin in your red blood cells. Relates to anemia.',
    displayOrder: 9,
    targetRange: '27 - 32',
  },
  {
    id: 'mchc',
    name: 'MCHC',
    displayName: 'MCHC',
    category: 'cbc',
    unit: '%',
    description: 'A hemoglobin-RBC ratio, measures the average amount of hemoglobin in your red blood cells. Relates to anemia.',
    displayOrder: 10,
    targetRange: '32 - 35%',
  },
  {
    id: 'rdw',
    name: 'RDW',
    displayName: 'RDW',
    category: 'cbc',
    unit: '%',
    description: 'Indicator of red blood cell size.',
    displayOrder: 11,
    targetRange: '<13',
  },
  {
    id: 'platelets',
    name: 'Platelets',
    displayName: 'Platelets',
    category: 'cbc',
    unit: 'K/µL',
    description: 'Cells in blood that form clots.',
    displayOrder: 12,
    targetRange: '150 - 450',
  },
  {
    id: 'neutrophils',
    name: 'Neutrophils',
    displayName: 'Neutrophils',
    category: 'cbc',
    unit: '%',
    description: 'Amount of infection fighting capacity. The "good guys".',
    displayOrder: 13,
    targetRange: '40 - 60%',
  },
  {
    id: 'lymphocytes',
    name: 'Lymphocytes',
    displayName: 'Lymphocytes',
    category: 'cbc',
    unit: '%',
    description: 'Aids in the destruction and handling of body toxins & by-products of protein metabolism. Relates to the healing process.',
    displayOrder: 14,
    targetRange: '25 - 40%',
  },
  {
    id: 'monocytes',
    name: 'Monocytes',
    displayName: 'Monocytes',
    category: 'cbc',
    unit: '%',
    description: 'Formed in the spleen and bone marrow they can ingest and digest large bacteria. Relates to normal tissue breakdown by the liver.',
    displayOrder: 15,
    targetRange: '<7%',
  },
  {
    id: 'eosinophils',
    name: 'Eosinophils',
    displayName: 'Eosinophils',
    category: 'cbc',
    unit: '%',
    description: 'Responsible for the protection and preservation of life via the immunologic response. Relates to Infections, inflammations, disease, and allergies.',
    displayOrder: 16,
    targetRange: '<3%',
  },
  {
    id: 'basophils',
    name: 'Basophils',
    displayName: 'Basophils',
    category: 'cbc',
    unit: '%',
    description: 'Involved in deep membrane allergies. Relates to the immune response, inflammation, and gastrointestinal tract.',
    displayOrder: 17,
    targetRange: '0 - 1',
  },
  {
    id: 'absolute-lymphocytes',
    name: 'Absolute Lymphocytes',
    displayName: 'Absolute Lymphocytes',
    category: 'cbc',
    unit: 'K/µL',
    description: 'Absolute count of lymphocytes in the blood.',
    displayOrder: 18,
    targetRange: '1.5 - 4.0',
  },
  {
    id: 'mpv',
    name: 'MPV',
    displayName: 'MPV (Mean Platelet Volume)',
    category: 'cbc',
    unit: 'fL',
    description: 'Average size of platelets found in the blood.',
    displayOrder: 19,
    targetRange: '9.4 - 12.3',
  },
];

// ============================================
// OMINOUS MARKERS - Critical thresholds
// ============================================
export const ominousMarkers: OminousMarker[] = [
  {
    id: 'albumin-low',
    name: 'Albumin below 4.0',
    testName: 'Albumin',
    threshold: 4.0,
    direction: 'below',
    description: 'Albumin below 4.0 g/dL is a concerning indicator',
  },
  {
    id: 'calcium-albumin-ratio',
    name: 'Calcium/Albumin ratio above 2.7',
    testName: 'Calcium/Albumin Ratio',
    threshold: 2.7,
    direction: 'above',
    description: 'Calcium divided by Albumin above 2.7',
  },
  {
    id: 'albumin-globulin-ratio',
    name: 'Albumin/Globulin ratio below 1',
    testName: 'Albumin/Globulin Ratio',
    threshold: 1.0,
    direction: 'below',
    description: 'Albumin divided by Globulin below 1.0',
  },
  {
    id: 'absolute-lymphocytes-low',
    name: 'Absolute Lymphocytes below 1,500',
    testName: 'Absolute Lymphocytes',
    threshold: 1.5, // in K/µL (1500 cells = 1.5 K/µL)
    direction: 'below',
    description: 'Absolute Lymphocytes below 1,500 cells/µL',
  },
  {
    id: 'lymphocytes-percent-low',
    name: 'Lymphocytes % below 20',
    testName: 'Lymphocytes',
    threshold: 20,
    direction: 'below',
    description: 'Lymphocytes percentage below 20%',
  },
  {
    id: 'total-cholesterol-low',
    name: 'Total cholesterol below 150 (fasting)',
    testName: 'Total Cholesterol',
    threshold: 150,
    direction: 'below',
    description: 'Fasting total cholesterol below 150 mg/dL',
  },
  {
    id: 'platelets-low',
    name: 'Platelets below 150',
    testName: 'Platelets',
    threshold: 150,
    direction: 'below',
    description: 'Platelet count below 150 K/µL',
  },
];

// Helper function to get markers by category
export function getMarkersByCategory(
  category: LabCategory,
  gender?: 'male' | 'female',
  age?: number
): LabMarker[] {
  return labMarkers
    .filter((marker) => {
      if (marker.category !== category) return false;

      // Filter by gender if marker is gender-specific
      if (marker.gender && gender && marker.gender !== gender) {
        return false;
      }

      // Filter by age if marker has age restrictions
      if (marker.ageMin !== undefined && age !== undefined && age < marker.ageMin) {
        return false;
      }
      if (marker.ageMax !== undefined && age !== undefined && age > marker.ageMax) {
        return false;
      }

      return true;
    })
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

// Helper to find marker by name (handles gender-specific markers)
export function findMarker(
  name: string,
  gender?: 'male' | 'female',
  age?: number
): LabMarker | undefined {
  const normalizedName = name.toLowerCase().trim();

  // First try exact match
  let marker = labMarkers.find(
    (m) => m.name.toLowerCase() === normalizedName || m.displayName.toLowerCase() === normalizedName
  );

  if (marker) return marker;

  // Try gender-specific match
  if (gender) {
    const genderSuffix = gender === 'male' ? '(male)' : '(female)';
    marker = labMarkers.find(
      (m) =>
        (m.name.toLowerCase().includes(normalizedName) &&
          m.name.toLowerCase().includes(genderSuffix)) ||
        (m.displayName.toLowerCase().includes(normalizedName) &&
          m.displayName.toLowerCase().includes(genderSuffix))
    );
    if (marker) return marker;
  }

  // Try age-specific match for cholesterol and LDL
  if (age !== undefined) {
    if (normalizedName.includes('cholesterol') && !normalizedName.includes('hdl') && !normalizedName.includes('ldl')) {
      if (gender === 'male') {
        if (age >= 18 && age <= 34) {
          marker = labMarkers.find((m) => m.id === 'total-cholesterol-male-18-34');
        } else if (age >= 35) {
          marker = labMarkers.find((m) => m.id === 'total-cholesterol-male-35-plus');
        }
      } else if (gender === 'female') {
        if (age >= 18 && age <= 34) {
          marker = labMarkers.find((m) => m.id === 'total-cholesterol-female-18-34');
        } else if (age >= 35 && age <= 44) {
          marker = labMarkers.find((m) => m.id === 'total-cholesterol-female-35-44');
        } else if (age >= 45) {
          marker = labMarkers.find((m) => m.id === 'total-cholesterol-female-45-plus');
        }
      }
      if (marker) return marker;
    }

    if (normalizedName.includes('ldl')) {
      if (age < 35) {
        marker = labMarkers.find((m) => m.id === 'ldl-cholesterol-under-35');
      } else {
        marker = labMarkers.find((m) => m.id === 'ldl-cholesterol-35-plus');
      }
      if (marker) return marker;
    }
  }

  // Fallback: partial match without gender suffix
  marker = labMarkers.find(
    (m) =>
      m.name.toLowerCase().includes(normalizedName) ||
      m.displayName.toLowerCase().includes(normalizedName)
  );

  return marker;
}

// Get all markers organized by category
export function getAllMarkersGroupedByCategory(): Record<LabCategory, LabMarker[]> {
  const grouped: Partial<Record<LabCategory, LabMarker[]>> = {};

  for (const marker of labMarkers) {
    if (!grouped[marker.category]) {
      grouped[marker.category] = [];
    }
    grouped[marker.category]!.push(marker);
  }

  // Sort markers within each category
  for (const category in grouped) {
    grouped[category as LabCategory]?.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  return grouped as Record<LabCategory, LabMarker[]>;
}
