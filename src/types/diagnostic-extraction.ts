// Diagnostic Extraction Types
// Schemas for data extracted from diagnostic files via Vision API

// ============================================
// HRV (Heart Rate Variability) Extraction
// ============================================

export interface HRVExtractedData {
  // Core metrics
  rmssd?: number                    // Root mean square of successive differences
  sdnn?: number                     // Standard deviation of NN intervals
  lf_hf_ratio?: number              // Low frequency / High frequency ratio
  hrv_score?: number                // Overall HRV score (0-100)
  heart_rate?: number               // Average heart rate

  // Pattern analysis
  patterns: {
    sympathetic_dominance: boolean  // Fight/flight overactive
    parasympathetic_dominance: boolean  // Rest/digest dominant
    balanced: boolean               // Normal autonomic balance
  }

  // Clinical findings - what's "off"
  findings: string[]                // e.g., ["Low parasympathetic tone", "Elevated stress response"]

  // Raw text for verification
  raw_notes?: string
}

// ============================================
// D-Pulse Extraction
// ============================================

export interface DPulseMarker {
  name: string                      // Organ/system name
  status: 'green' | 'yellow' | 'red'
  value?: number
  notes?: string
}

export interface DPulseExtractedData {
  // Overall assessment
  overall_status: 'normal' | 'caution' | 'concern'

  // Individual markers with traffic light status
  markers: DPulseMarker[]

  // Deal breakers (red markers) - CRITICAL for protocol generation
  deal_breakers: string[]           // e.g., ["Heart", "Kidney", "Liver"]

  // Caution areas (yellow markers)
  caution_areas: string[]

  // Summary counts
  green_count: number
  yellow_count: number
  red_count: number

  // Additional notes
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
    status: 'low' | 'optimal' | 'high'  // low < 6.0, optimal 6.0-7.5, high > 7.5
  }

  specific_gravity: {
    value: number                   // e.g., 1.020
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

  // Clinical interpretation
  findings: string[]

  // Protocol triggers based on BFM rules
  recommended_protocols: {
    // pH low → Cell Synergy or Trisalts
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
