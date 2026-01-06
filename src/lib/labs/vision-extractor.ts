// Vision Extractor for Labs
// Bridges Vision API extraction to Labs parser format

import { extractLabPanel } from '@/lib/vision/extractors/lab-panel-extractor'
import { labMarkers } from '@/data/lab-data'

// Output format matching pdf-parser.ts
interface ParsedLabValue {
  markerName: string
  markerId: string | null
  value: number
  unit: string | null
  confidence: number
}

interface LabParseResult {
  success: boolean
  values: ParsedLabValue[]
  rawText: string
  warnings: string[]
}

// Marker aliases for fuzzy matching (same as pdf-parser.ts)
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
}

/**
 * Find matching marker in labMarkers database
 */
function findMatchingMarker(testName: string): { id: string; name: string } | null {
  const normalizedTestName = testName.toLowerCase().trim()

  // First try direct match against our markers
  for (const marker of labMarkers) {
    if (
      marker.displayName.toLowerCase() === normalizedTestName ||
      marker.name.toLowerCase() === normalizedTestName
    ) {
      return { id: marker.id, name: marker.displayName }
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
        )
        if (marker) {
          return { id: marker.id, name: marker.displayName }
        }
      }
    }
  }

  // Try partial match as last resort
  for (const marker of labMarkers) {
    if (
      normalizedTestName.includes(marker.displayName.toLowerCase()) ||
      marker.displayName.toLowerCase().includes(normalizedTestName)
    ) {
      return { id: marker.id, name: marker.displayName }
    }
  }

  return null
}

/**
 * Extract lab panel values from an image using Vision API
 * Returns data in the same format as parseLabPdf() for compatibility
 */
export async function extractLabPanelVision(imageDataUrl: string): Promise<LabParseResult> {
  try {
    const visionResult = await extractLabPanel(imageDataUrl)

    if (!visionResult.success) {
      return {
        success: false,
        values: [],
        rawText: visionResult.rawResponse,
        warnings: visionResult.data?.warnings || [visionResult.error || 'Vision extraction failed'],
      }
    }

    const values: ParsedLabValue[] = []
    const warnings: string[] = [...(visionResult.data.warnings || [])]
    const seenMarkers = new Set<string>()

    // Process Vision API results and match to our lab markers
    for (const visionValue of visionResult.data.values) {
      const matchedMarker = findMatchingMarker(visionValue.markerName)

      if (matchedMarker && !seenMarkers.has(matchedMarker.id)) {
        seenMarkers.add(matchedMarker.id)
        values.push({
          markerName: matchedMarker.name,
          markerId: matchedMarker.id,
          value: visionValue.value,
          unit: visionValue.unit,
          confidence: 0.8, // High confidence for matched markers
        })
      } else if (!matchedMarker) {
        // Still track unmatched values with lower confidence
        values.push({
          markerName: visionValue.rawName || visionValue.markerName,
          markerId: null,
          value: visionValue.value,
          unit: visionValue.unit,
          confidence: 0.4,
        })
        warnings.push(
          `Could not match "${visionValue.rawName || visionValue.markerName}" to a known lab marker`
        )
      }
    }

    // Sort by confidence (matched markers first)
    const sortedValues = values.sort((a, b) => b.confidence - a.confidence)

    return {
      success: sortedValues.length > 0,
      values: sortedValues,
      rawText: visionResult.rawResponse,
      warnings,
    }
  } catch (error) {
    console.error('Vision extraction error:', error)
    return {
      success: false,
      values: [],
      rawText: '',
      warnings: [error instanceof Error ? error.message : 'Unknown error'],
    }
  }
}
