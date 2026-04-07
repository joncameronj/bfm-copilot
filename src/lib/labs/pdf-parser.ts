import { labMarkers } from '@/data/lab-data';

interface ParsedLabValue {
  markerName: string;
  markerId: string | null;
  value: number;
  unit: string | null;
  confidence: number;
}

interface PdfParseResult {
  success: boolean;
  values: ParsedLabValue[];
  rawText: string;
  warnings: string[];
}

// Common lab marker name variations to help match
const MARKER_ALIASES: Record<string, string[]> = {
  'NT-proBNP': ['NT-proBNP', 'NT proBNP', 'BNP', 'Pro-BNP'],
  CRP: ['CRP', 'C-Reactive Protein', 'C Reactive Protein', 'hs-CRP', 'hsCRP'],
  Homocysteine: ['Homocysteine', 'HCY'],
  'Uric Acid': ['Uric Acid', 'Urate'],
  Iron: ['Iron', 'Serum Iron', 'Fe'],
  UIBC: ['UIBC', 'Unsaturated Iron Binding Capacity'],
  TIBC: ['TIBC', 'Total Iron Binding Capacity'],
  Transferrin: ['Transferrin', 'TRF'],
  'Transferrin Saturation': ['Transferrin Sat', 'Transferrin Saturation', 'TSAT', 'Iron Saturation'],
  'Vitamin B12': ['B12', 'Vitamin B12', 'Cobalamin', 'B-12'],
  Folate: ['Folate', 'Folic Acid', 'Serum Folate'],
  Ferritin: ['Ferritin', 'Serum Ferritin'],
  'Total Cholesterol': ['Total Cholesterol', 'Cholesterol', 'TC', 'Cholesterol, Total'],
  Triglycerides: ['Triglycerides', 'TG', 'Trigs'],
  HDL: ['HDL', 'HDL Cholesterol', 'HDL-C', 'High Density Lipoprotein'],
  LDL: ['LDL', 'LDL Cholesterol', 'LDL-C', 'Low Density Lipoprotein'],
  sdLDL: ['sdLDL', 'Small Dense LDL', 'sd-LDL'],
  'Apo A-1': ['Apo A-1', 'Apolipoprotein A-1', 'Apo-A1', 'ApoA1'],
  'Apo B': ['Apo B', 'Apolipoprotein B', 'ApoB', 'Apo-B'],
  'Lp(a)': ['Lp(a)', 'Lipoprotein(a)', 'Lipoprotein a', 'LPa'],
  Glucose: ['Glucose', 'Blood Glucose', 'Fasting Glucose', 'FBG'],
  Insulin: ['Insulin', 'Fasting Insulin', 'Serum Insulin'],
  HbA1C: ['HbA1c', 'A1C', 'Hemoglobin A1c', 'Glycated Hemoglobin', 'A1c'],
  Calcium: ['Calcium', 'Ca', 'Serum Calcium', 'Total Calcium'],
  Albumin: ['Albumin', 'Serum Albumin', 'ALB'],
  PTH: ['PTH', 'Parathyroid Hormone', 'Intact PTH', 'iPTH'],
  'Vitamin D': ['Vitamin D', 'Vit D', '25-OH Vitamin D', '25-Hydroxy Vitamin D', '25(OH)D'],
  Magnesium: ['Magnesium', 'Mg', 'Serum Magnesium'],
  Sodium: ['Sodium', 'Na'],
  Potassium: ['Potassium', 'K'],
  Chloride: ['Chloride', 'Cl'],
  CO2: ['CO2', 'Carbon Dioxide', 'Bicarbonate', 'HCO3'],
  BUN: ['BUN', 'Blood Urea Nitrogen', 'Urea Nitrogen'],
  'Total Protein': ['Total Protein', 'Protein, Total', 'Serum Protein'],
  Creatinine: ['Creatinine', 'Serum Creatinine', 'Cr'],
  'Cystatin C': ['Cystatin C', 'Cys-C'],
  eGFR: ['eGFR', 'GFR', 'Estimated GFR', 'Glomerular Filtration Rate'],
  ALT: ['ALT', 'SGPT', 'Alanine Aminotransferase'],
  AST: ['AST', 'SGOT', 'Aspartate Aminotransferase'],
  GGT: ['GGT', 'Gamma GT', 'Gamma-Glutamyl Transferase'],
  'Alkaline Phosphatase': ['Alk Phos', 'Alkaline Phosphatase', 'ALP'],
  'Total Bilirubin': ['Total Bilirubin', 'Bilirubin, Total', 'T-Bili', 'TBIL'],
  'Direct Bilirubin': ['Direct Bilirubin', 'Bilirubin, Direct', 'D-Bili', 'DBIL'],
  TSH: ['TSH', 'Thyroid Stimulating Hormone'],
  'T4 Total': ['T4', 'T4 Total', 'Total T4', 'Thyroxine'],
  'T4 Free': ['Free T4', 'FT4', 'T4 Free'],
  'T3 Total': ['T3', 'T3 Total', 'Total T3', 'Triiodothyronine'],
  'T3 Free': ['Free T3', 'FT3', 'T3 Free'],
  WBC: ['WBC', 'White Blood Cell', 'White Blood Cells', 'Leukocytes'],
  RBC: ['RBC', 'Red Blood Cell', 'Red Blood Cells', 'Erythrocytes'],
  Hemoglobin: ['Hemoglobin', 'Hgb', 'Hb'],
  Hematocrit: ['Hematocrit', 'Hct', 'HCT'],
  MCV: ['MCV', 'Mean Corpuscular Volume'],
  MCH: ['MCH', 'Mean Corpuscular Hemoglobin'],
  MCHC: ['MCHC', 'Mean Corpuscular Hemoglobin Concentration'],
  RDW: ['RDW', 'Red Cell Distribution Width', 'RDW-CV'],
  Platelets: ['Platelets', 'PLT', 'Platelet Count', 'Thrombocytes'],
  Neutrophils: ['Neutrophils', 'Neut', 'Neutrophil', 'ANC'],
  Lymphocytes: ['Lymphocytes', 'Lymph', 'Lymphocyte'],
  Monocytes: ['Monocytes', 'Mono', 'Monocyte'],
  Eosinophils: ['Eosinophils', 'Eos', 'Eosinophil'],
  Basophils: ['Basophils', 'Baso', 'Basophil'],
  Estradiol: ['Estradiol', 'E2', 'Estrogen'],
  FSH: ['FSH', 'Follicle Stimulating Hormone'],
  'DHEA-S': ['DHEA-S', 'DHEA Sulfate', 'DHEAS'],
  LH: ['LH', 'Luteinizing Hormone'],
  SHBG: ['SHBG', 'Sex Hormone Binding Globulin'],
  Testosterone: ['Testosterone', 'Total Testosterone'],
  Progesterone: ['Progesterone', 'P4'],
  Globulin: ['Globulin', 'Total Globulin', 'Serum Globulin'],
};

// Regex patterns to extract lab values from text
const VALUE_PATTERNS = [
  // Pattern: "Test Name: 123.45 unit" or "Test Name 123.45 unit"
  /([A-Za-z][A-Za-z0-9\s\-\(\)\/,]+?)[\s:]+?([\d,]+\.?\d*)\s*([A-Za-z\/%]+)?/gi,
  // Pattern: "123.45 - Test Name"
  /([\d,]+\.?\d*)\s*[\-]\s*([A-Za-z][A-Za-z0-9\s\-\(\)\/]+)/gi,
  // Pattern with reference range: "Test Name 123.45 (ref: 50-100)"
  /([A-Za-z][A-Za-z0-9\s\-\(\)\/,]+?)[\s:]+?([\d,]+\.?\d*)\s*\([\w\s:]+[\d\.\-]+\)/gi,
];

function normalizeNumber(str: string): number {
  // Remove commas and parse
  return parseFloat(str.replace(/,/g, ''));
}

function findMatchingMarker(testName: string): { id: string; name: string } | null {
  const normalizedTestName = testName.toLowerCase().trim();

  // First try direct match against our markers
  for (const marker of labMarkers) {
    if (
      marker.displayName.toLowerCase() === normalizedTestName ||
      marker.name.toLowerCase() === normalizedTestName
    ) {
      return { id: marker.id, name: marker.displayName };
    }
  }

  // Then try aliases
  for (const [markerName, aliases] of Object.entries(MARKER_ALIASES)) {
    for (const alias of aliases) {
      if (alias.toLowerCase() === normalizedTestName) {
        // Find the marker with this name
        const marker = labMarkers.find(
          (m) =>
            m.displayName.toLowerCase().includes(markerName.toLowerCase()) ||
            m.name.toLowerCase().includes(markerName.toLowerCase())
        );
        if (marker) {
          return { id: marker.id, name: marker.displayName };
        }
      }
    }
  }

  // Try partial match as last resort — but only when the test name is long
  // enough to be meaningful and the match is close in length to avoid
  // false positives (e.g., "Transferrin Saturation" matching "Transferrin"
  // or random text near numbers matching short marker names).
  for (const marker of labMarkers) {
    const markerLower = marker.displayName.toLowerCase();
    const nameLower = marker.name.toLowerCase();

    // Only allow partial matches when:
    // 1. The test name is at least 4 chars (avoid matching "Na", "Ca" etc. randomly)
    // 2. The lengths are within 50% of each other (avoid "Transferrin" matching "Transferrin Saturation")
    const lengthRatio = normalizedTestName.length / markerLower.length;
    const nameRatio = normalizedTestName.length / nameLower.length;

    if (normalizedTestName.length >= 4) {
      if (
        normalizedTestName === markerLower ||
        normalizedTestName === nameLower
      ) {
        return { id: marker.id, name: marker.displayName };
      }
      if (
        (normalizedTestName.includes(markerLower) || markerLower.includes(normalizedTestName)) &&
        lengthRatio >= 0.6 && lengthRatio <= 1.5
      ) {
        return { id: marker.id, name: marker.displayName };
      }
      if (
        (normalizedTestName.includes(nameLower) || nameLower.includes(normalizedTestName)) &&
        nameRatio >= 0.6 && nameRatio <= 1.5
      ) {
        return { id: marker.id, name: marker.displayName };
      }
    }
  }

  return null;
}

export async function parseLabPdf(text: string): Promise<PdfParseResult> {
  const values: ParsedLabValue[] = [];
  const warnings: string[] = [];
  const seenMarkers = new Set<string>();

  // Try each pattern
  for (const pattern of VALUE_PATTERNS) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Depending on pattern, extract test name and value
      let testName: string;
      let valueStr: string;
      let unit: string | null = null;

      if (match.length >= 4) {
        // Pattern with unit
        testName = match[1];
        valueStr = match[2];
        unit = match[3] || null;
      } else {
        testName = match[1];
        valueStr = match[2];
      }

      // Clean up
      testName = testName.trim();
      const value = normalizeNumber(valueStr);

      if (isNaN(value)) continue;

      // Try to match to our markers
      const matchedMarker = findMatchingMarker(testName);

      if (matchedMarker && !seenMarkers.has(matchedMarker.id)) {
        seenMarkers.add(matchedMarker.id);
        values.push({
          markerName: matchedMarker.name,
          markerId: matchedMarker.id,
          value,
          unit,
          confidence: 0.8, // High confidence for matched markers
        });
      } else if (!matchedMarker) {
        // Still track unmatched values with lower confidence
        values.push({
          markerName: testName,
          markerId: null,
          value,
          unit,
          confidence: 0.4,
        });
        warnings.push(`Could not match "${testName}" to a known lab marker`);
      }
    }
  }

  return {
    success: values.length > 0,
    values: values.sort((a, b) => b.confidence - a.confidence),
    rawText: text,
    warnings,
  };
}

export function extractTextFromLines(lines: string[]): ParsedLabValue[] {
  const values: ParsedLabValue[] = [];
  const seenMarkers = new Set<string>();

  for (const line of lines) {
    // Try to extract test name and value from each line
    const parts = line.split(/[\s\t:]+/);

    // Look for a number in the parts
    for (let i = 0; i < parts.length; i++) {
      const potentialValue = normalizeNumber(parts[i]);
      if (!isNaN(potentialValue) && potentialValue > 0) {
        // Try the preceding parts as the test name
        const testName = parts.slice(0, i).join(' ').trim();
        if (testName.length >= 2) {
          const matchedMarker = findMatchingMarker(testName);
          if (matchedMarker && !seenMarkers.has(matchedMarker.id)) {
            seenMarkers.add(matchedMarker.id);
            values.push({
              markerName: matchedMarker.name,
              markerId: matchedMarker.id,
              value: potentialValue,
              unit: parts[i + 1] || null,
              confidence: 0.7,
            });
          }
        }
      }
    }
  }

  return values;
}
