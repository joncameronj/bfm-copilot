// EvalReport → GeneratedAnalysis Mapper
// Pure function that converts the Python eval agent's EvalReport
// into the GeneratedAnalysis shape used by the existing DB persistence layer.

import type { RecommendedFrequency, Supplementation } from '@/types/diagnostic-analysis'

// ============================================
// EVAL REPORT TYPES (mirror Python EvalReport)
// ============================================

export interface EvalDealBreaker {
  name: string
  finding: string
  protocol: string
  urgency: string
  patient_data_citation: string
}

export interface EvalFrequencyPhase {
  phase: number
  protocol_name: string
  trigger: string
  patient_data_citation: string
  sequencing_note: string
  layer_label: string
  layer_description: string
}

export interface EvalSupplementItem {
  name: string
  trigger: string
  dosage: string
  timing: string
  patient_data_citation: string
  priority: number
  layer: number
}

export interface EvalLever {
  lever_number: number
  lever_name: string
  patient_status: string
  recommendation: string
  patient_data_citation: string
}

export interface EvalPatientAnalogy {
  finding: string
  analogy: string
  what_this_means: string
  hopeful_framing: string
}

export interface EvalUrgencyRating {
  score: number
  rationale: string
  timeline: string
  critical_path: string
}

export interface EvalMonitoringItem {
  metric: string
  baseline: string
  target: string
  reassessment_interval: string
}

export interface EvalReport {
  patient_name: string
  report_date: string
  urgency: EvalUrgencyRating
  deal_breakers: EvalDealBreaker[]
  frequency_phases: EvalFrequencyPhase[]
  supplementation: EvalSupplementItem[]
  five_levers: EvalLever[]
  patient_analogies: EvalPatientAnalogy[]
  monitoring: EvalMonitoringItem[]
  clinical_summary: string
  confidence_notes: string
}

// ============================================
// MAPPED OUTPUT TYPES
// ============================================

export interface MappedProtocol {
  title: string
  description: string
  category: string
  frequencies: RecommendedFrequency[]
  priority: number
}

export interface MappedAnalysis {
  summary: string
  protocols: MappedProtocol[]
  supplementation: Supplementation[]
  reasoningChain: string[]
}

// ============================================
// LAYER CONFIG
// ============================================

const LAYER_TITLES: Record<number, string> = {
  1: 'Deal Breaker Protocols',
  2: 'Condition-Specific Protocols',
  3: 'Escalation Protocols',
}

const LAYER_CATEGORIES: Record<number, string> = {
  1: 'general',
  2: 'organ',
  3: 'hormone',
}

// ============================================
// MAPPER FUNCTION
// ============================================

/**
 * Convert an EvalReport from the Python eval agent into the GeneratedAnalysis
 * shape that the existing DB persistence and frequency validation pipeline expects.
 *
 * This is a pure function — no side effects, no DB calls.
 */
export function mapEvalReportToGeneratedAnalysis(
  evalReport: EvalReport,
): MappedAnalysis {
  // 1. Map frequency_phases → protocols grouped by phase
  const phaseGroups = new Map<number, EvalFrequencyPhase[]>()
  for (const fp of evalReport.frequency_phases) {
    const phase = fp.phase
    if (!phaseGroups.has(phase)) {
      phaseGroups.set(phase, [])
    }
    phaseGroups.get(phase)!.push(fp)
  }

  const protocols: MappedProtocol[] = []
  for (const [phase, frequencies] of phaseGroups) {
    const clampedPhase = Math.min(Math.max(phase, 1), 3)
    protocols.push({
      title: frequencies[0]?.layer_label || LAYER_TITLES[clampedPhase] || `Layer ${clampedPhase} Protocols`,
      description: frequencies[0]?.layer_description || '',
      category: LAYER_CATEGORIES[clampedPhase] || 'general',
      frequencies: frequencies.map((fp) => ({
        id: crypto.randomUUID(),
        name: fp.protocol_name,
        rationale: fp.patient_data_citation,
        source_reference: fp.sequencing_note || undefined,
        diagnostic_trigger: fp.trigger,
      })),
      priority: clampedPhase,
    })
  }

  // Sort protocols by priority (layer)
  protocols.sort((a, b) => a.priority - b.priority)

  // 2. Map supplementation
  const supplementation: Supplementation[] = evalReport.supplementation.map((s) => ({
    name: s.name,
    dosage: s.dosage,
    timing: s.timing,
    rationale: `${s.trigger}${s.patient_data_citation ? ` — ${s.patient_data_citation}` : ''}`,
    layer: s.layer || 0,
  }))

  // 3. Build reasoning chain from deal breakers
  const reasoningChain: string[] = evalReport.deal_breakers.map(
    (db) => `Deal Breaker: ${db.name} — ${db.finding} → ${db.protocol} (${db.patient_data_citation})`
  )

  return {
    summary: evalReport.clinical_summary,
    protocols,
    supplementation,
    reasoningChain,
  }
}
