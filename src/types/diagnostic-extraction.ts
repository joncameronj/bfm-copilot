// Diagnostic Extraction Types
// Schemas for data extracted from diagnostic files via Vision API

// ============================================
// HRV (Heart Rate Variability) Extraction
// BFM-specific format: 2D grid (SNS x PNS) with dot positions,
// System Energy, Stress Response, and Brainwave Percentages
// ============================================

export interface HRVDotPosition {
  pns: number                       // PNS axis value (-4 to +4)
  sns: number                       // SNS axis value (-4 to +4)
}

export interface HRVExtractedData {
  // BFM-specific metrics
  system_energy?: number            // 1-13 scale (1-4 athlete, 5-9 healthy, 10-13 energetic debt)
  stress_response?: number          // 1-7 scale (1=best, 7=worst)

  // Dot positions on SNS/PNS grid
  calm_position?: HRVDotPosition    // Blue dot (laying down)
  stressed_position?: HRVDotPosition // Red dot (standing up)
  recovery_position?: HRVDotPosition // Green dot (seated/breathing)

  // Legacy metrics (from NervExpress Ortho/Valsalva reports)
  rmssd?: number
  sdnn?: number
  lf_hf_ratio?: number
  hrv_score?: number
  heart_rate?: number

  // Pattern analysis
  patterns: {
    sympathetic_dominance: boolean
    parasympathetic_dominance: boolean
    balanced: boolean
    switched_sympathetics: boolean   // SNS/PNS reversed (Deal Breaker #1)
    pns_negative: boolean            // PNS in negative zone
    vagus_dysfunction: boolean       // Abnormal vagal response
  }

  // Brainwave percentages (often on BFM HRV images)
  brainwave?: {
    alpha: number                    // % (normal ~15-20%, low <10% = pain indicator)
    beta: number                     // % (normal ~15-20%, high >25% = midbrain set point high)
    delta: number                    // % (normal ~5-10% waking, high >20% = low direct current)
    gamma: number                    // % (normal ~5-10%, high >30% = racing brain)
    theta: number                    // % (normal ~5-10%, if theta > alpha = deal breaker)
  }

  // Deal breakers detected from HRV/Brainwave
  deal_breakers: string[]

  // Clinical findings
  findings: string[]

  raw_notes?: string
}

// ============================================
// D-Pulse Extraction
// ============================================

export interface DPulseMarker {
  name: string                      // Organ/system name
  percentage: number                // 0-100% energy level
  status: 'green' | 'yellow' | 'red' // green >60%, yellow 40-60%, red <40%
  notes?: string
  // Keep legacy 'value' as alias for percentage
  value?: number
}

export interface DPulseExtractedData {
  // Overall assessment
  overall_status: 'normal' | 'caution' | 'critical'

  // System-level metrics
  stress_index?: number              // 10-100 units (normal range)
  vegetative_balance?: number        // 35-140 units (normal range)
  brain_activity?: number            // Percentage
  immunity?: number                  // Percentage
  physiological_resources?: number   // 150-600 units (normal range)

  // Individual markers with percentages
  markers: DPulseMarker[]

  // Deal breakers (percentage < 40%) - CRITICAL for protocol generation
  deal_breakers: string[]           // e.g., ["Heart (26%)", "Kidney (16%)"]

  // Caution areas (percentage 40-60%)
  caution_areas: string[]

  // Seven Deal Breaker organs status
  seven_deal_breakers?: {
    heart?: { percentage: number; status: 'green' | 'yellow' | 'red' }
    liver?: { percentage: number; status: 'green' | 'yellow' | 'red' }
    kidney?: { percentage: number; status: 'green' | 'yellow' | 'red' }
    cervical?: { percentage: number; status: 'green' | 'yellow' | 'red' }
    thoracic?: { percentage: number; status: 'green' | 'yellow' | 'red' }
    lumbar?: { percentage: number; status: 'green' | 'yellow' | 'red' }
    sacrum?: { percentage: number; status: 'green' | 'yellow' | 'red' }
  }

  // Summary counts
  green_count: number
  yellow_count: number
  red_count: number
  average_energy?: number

  raw_notes?: string
}

// ============================================
// Urinalysis (UA) Extraction
// ============================================

export interface UAValueWithStatus<T> {
  value: T
  status: string
}

export interface UAExtractedData {
  // Core values
  ph: {
    value: number                   // e.g., 6.5
    status: 'low' | 'optimal' | 'high'  // low < 6.5 (BFM threshold), optimal 6.5-7.5, high > 7.5
  }

  specific_gravity: {
    value: number                   // e.g., 1.020
    status: 'low' | 'normal' | 'high'
  }

  uric_acid?: {
    value: number | string          // e.g., 700
    status: 'low' | 'normal' | 'high'
  }

  protein: {
    value: string                   // "Negative", "Trace", "1+", "2+", "3+"
    status: 'negative' | 'trace' | 'positive'
  }

  glucose?: {
    value: string
    status: 'negative' | 'positive'
  }

  ketones?: {
    value: string
    status: 'negative' | 'trace' | 'positive'
  }

  blood?: {
    value: string
    status: 'negative' | 'positive'
  }

  // Additional markers
  leukocytes?: UAValueWithStatus<string>
  nitrites?: UAValueWithStatus<string>
  bilirubin?: UAValueWithStatus<string>
  urobilinogen?: UAValueWithStatus<string>

  // Heavy metals (sometimes shown on UA report)
  heavy_metals?: string[]           // e.g., ["Cadmium", "Copper"]

  // VCS (Visual Contrast Scale) - often on same page as UA
  vcs_score?: {
    correct: number                 // Number correct out of 32
    total: number                   // Always 32
    passed: boolean                 // 24+ = passing
  }

  // Clinical interpretation
  findings: string[]

  // Protocol triggers based on BFM rules
  recommended_protocols: {
    // pH low (<6.5) → Cell Synergy or Trisalts
    ph_low_protocol?: 'cell_synergy' | 'trisalts'
    // Protein off → X39 patches
    protein_protocol?: 'x39_patches'
  }
}

// ============================================
// VCS (Visual Contrast Sensitivity) Extraction
// ============================================

export interface VCSEyeResult {
  scores: number[]                  // Scores for columns A, B, C, D, E
  passed: boolean
}

export interface VCSExtractedData {
  // Overall result
  passed: boolean

  // Individual eye scores
  right_eye: VCSEyeResult
  left_eye: VCSEyeResult

  // Columns that failed (C, D, E are most significant for biotoxin)
  failed_columns: string[]          // e.g., ["C", "D", "E"]

  // Clinical interpretation
  biotoxin_likely: boolean
  severity: 'none' | 'mild' | 'moderate' | 'severe'

  // Findings
  findings: string[]

  // Protocol triggers based on BFM rules
  // VCS low/failed → Pectasol-C or Leptin settings
  recommended_protocols: {
    vcs_low_protocol?: 'pectasol' | 'leptin_settings'
  }
}

// ============================================
// Brainwave/EEG Extraction
// ============================================

export interface BrainwaveExtractedData {
  // Brain wave bands
  delta?: { value: number; status: 'low' | 'normal' | 'high' }    // 0.5-4 Hz
  theta?: { value: number; status: 'low' | 'normal' | 'high' }    // 4-8 Hz
  alpha?: { value: number; status: 'low' | 'normal' | 'high' }    // 8-12 Hz
  beta?: { value: number; status: 'low' | 'normal' | 'high' }     // 12-30 Hz
  gamma?: { value: number; status: 'low' | 'normal' | 'high' }    // 30+ Hz

  // Pattern findings
  patterns: {
    dominant_wave: 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma'
    imbalances: string[]            // e.g., ["Low alpha", "High beta"]
  }

  // FSM protocol indicators
  findings: string[]
  fsm_indicators: string[]          // Specific FSM frequency recommendations
}

// ============================================
// Ortho Test Extraction (NervExpress)
// ============================================

export interface OrthoMeasurement {
  hr: number                          // Heart Rate (bpm)
  r_hf: number                       // R(HF) power
  r_lf1: number                      // R(LF1) power
  r_lf2: number                      // R(LF2) power
}

export interface OrthoExtractedData {
  supine: OrthoMeasurement            // Supine (laying, blue dot)
  upright: OrthoMeasurement           // Upright (standing, red dot)

  // ANS assessment
  physical_fitness_level?: string     // e.g., "11/7"
  ans_assessment?: string             // e.g., "PSNS BLOCKED, SNS SWITCHED"
  psns_status?: string                // e.g., "blocked", "normal", "weak"
  sns_status?: string                 // e.g., "switched", "normal", "excessive"

  // Dot superimposition (computed downstream, not from vision)
  dots_superimposed?: boolean

  findings: string[]
}

// ============================================
// Valsalva Test Extraction (NervExpress)
// ============================================

export interface ValsalvaMeasurement {
  hr: number                          // Heart Rate (bpm)
  r_hf: number                       // R(HF) power
  r_lf1: number                      // R(LF1) power
  r_lf2: number                      // R(LF2) power
}

export interface ValsalvaExtractedData {
  normal_breathing: ValsalvaMeasurement   // Normal breathing (blue dot)
  deep_breathing: ValsalvaMeasurement     // Deep breathing (green dot)

  // Ratios
  ei_ratio?: number                   // Expiration/Inspiration ratio (normal > 1.2)
  valsalva_ratio?: number             // Valsalva ratio (normal > 1.2)

  // ANS assessment
  ans_assessment?: string
  vagus_function?: string             // e.g., "normal", "impaired", "blocked"

  // Dot superimposition (computed downstream, not from vision)
  dots_superimposed?: boolean

  findings: string[]
}

// ============================================
// Blood Panel Extraction (enhanced)
// ============================================

export interface BloodMarker {
  name: string
  value: number
  unit: string
  reference_range?: string
  status: 'low' | 'normal' | 'high'
}

export interface BloodPanelExtractedData {
  markers: BloodMarker[]

  // Ominous markers triggered (per BFM protocol)
  ominous_triggers: string[]

  // Summary
  total_markers: number
  out_of_range_count: number

  // Lab categories affected
  affected_categories: string[]     // e.g., ["thyroid", "inflammation", "lipids"]
}

// ============================================
// Unified Extraction Result
// ============================================

export interface ExtractionResult<T> {
  success: boolean
  data: T
  confidence: number                // 0.0 to 1.0
  rawResponse: string
  error?: string
}

// ============================================
// Diagnostic Data Summary (for analysis generator)
// ============================================

export interface DiagnosticDataSummary {
  hrv: HRVExtractedData | null
  dPulse: DPulseExtractedData | null
  ua: UAExtractedData | null
  vcs: VCSExtractedData | null
  brainwave: BrainwaveExtractedData | null
  ortho: OrthoExtractedData | null
  valsalva: ValsalvaExtractedData | null
  bloodPanel: BloodPanelExtractedData | null

  // Aggregated critical findings
  dealBreakers: string[]            // All deal breakers from D-Pulse and ominous markers
  findings: string[]                // All findings across diagnostics

  // Protocol triggers from UA/VCS rules
  protocolTriggers: {
    phLow: boolean
    proteinPositive: boolean
    vcsLow: boolean
  }
}

// ============================================
// Approved Frequency Name
// ============================================

export interface ApprovedFrequencyName {
  id: string
  name: string
  aliases: string[]
  category: string | null
  description: string | null
  isActive: boolean
  createdAt: Date
}

// ============================================
// Recommendation Reasoning (Explainability)
// ============================================

export interface RagChunkReference {
  chunk_id: string
  document_id: string
  title: string | null
  content_snippet: string
  similarity: number
}

export interface SundayDocReference {
  filename: string
  section: string
  quote: string
}

export interface DiagnosticTrigger {
  type: string                      // 'd_pulse', 'ua', 'vcs', etc.
  finding: string                   // "pH low", "VCS failed", etc.
  value: string                     // Actual value
  interpretation: string            // What this means
}

export interface RecommendationReasoning {
  id: string
  protocolRecommendationId: string
  frequencyName: string

  // Source attribution
  ragChunksUsed: RagChunkReference[]
  sundayDocReferences: SundayDocReference[]

  // Diagnostic triggers
  diagnosticTriggers: DiagnosticTrigger[]
  patientConditions: string[]

  // AI reasoning
  reasoningSteps: string[]
  confidenceScore: number

  // Validation
  validated: boolean
  validationError: string | null

  createdAt: Date
}
