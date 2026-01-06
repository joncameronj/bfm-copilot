// Reasoning Generator for Protocol Recommendations
// Populates recommendation_reasoning table with explainability data

import { createClient } from '@/lib/supabase/server'
import type {
  DiagnosticDataSummary,
  SundayDocReference,
  DiagnosticTrigger,
  RagChunkReference,
} from '@/types/diagnostic-extraction'

// ============================================
// TYPES
// ============================================

interface RagChunk {
  chunk_id: string
  document_id: string
  content: string
  title: string | null
  filename: string
  similarity: number
  seminar_day?: string
  search_phase?: string
}

interface FrequencyWithReasoning {
  name: string
  rationale?: string
  source_reference?: string
  diagnostic_trigger?: string
}

interface ReasoningInput {
  recommendationId: string
  frequencies: FrequencyWithReasoning[]
  ragChunks: RagChunk[]
  diagnosticData: DiagnosticDataSummary | null
  reasoningChain: string[]
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Create reasoning records for each frequency in a protocol recommendation
 * This populates the recommendation_reasoning table for explainability
 */
export async function createReasoningRecords(input: ReasoningInput): Promise<void> {
  const { recommendationId, frequencies, ragChunks, diagnosticData, reasoningChain } = input
  const supabase = await createClient()

  for (const freq of frequencies) {
    try {
      // 1. Find RAG chunks that mention this frequency
      const relevantChunks = findRelevantChunks(freq.name, ragChunks)

      // 2. Extract Sunday doc references specifically
      const sundayRefs = extractSundayReferences(freq.name, ragChunks)

      // 3. Build diagnostic triggers for this frequency
      const triggers = buildDiagnosticTriggers(freq, diagnosticData)

      // 4. Calculate confidence score
      const confidence = calculateConfidence(relevantChunks, sundayRefs, triggers)

      // 5. Insert reasoning record
      const { error } = await supabase.from('recommendation_reasoning').insert({
        protocol_recommendation_id: recommendationId,
        frequency_name: freq.name,
        rag_chunks_used: relevantChunks.map((c) => ({
          chunk_id: c.chunk_id,
          document_id: c.document_id,
          title: c.title,
          content_snippet: c.content.slice(0, 300),
          similarity: c.similarity,
        })),
        sunday_doc_references: sundayRefs,
        diagnostic_triggers: triggers,
        reasoning_steps: reasoningChain,
        confidence_score: confidence,
        validated: true, // Already validated by frequency-validator
      })

      if (error) {
        console.error(`Failed to create reasoning for ${freq.name}:`, error)
      }
    } catch (err) {
      console.error(`Error creating reasoning record for ${freq.name}:`, err)
    }
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Find RAG chunks that mention the frequency name
 */
function findRelevantChunks(frequencyName: string, ragChunks: RagChunk[]): RagChunk[] {
  const normalizedName = frequencyName.toLowerCase()

  return ragChunks.filter((chunk) => {
    const normalizedContent = chunk.content.toLowerCase()

    // Check if content mentions the frequency name
    if (normalizedContent.includes(normalizedName)) {
      return true
    }

    // Also check for partial matches (e.g., "Liver" in "Liver Inflame")
    const nameParts = normalizedName.split(' ')
    return nameParts.some((part) => part.length > 3 && normalizedContent.includes(part))
  })
}

/**
 * Extract Sunday document references for a frequency
 * Sunday docs are the PRIMARY source for protocol decisions
 */
function extractSundayReferences(
  frequencyName: string,
  ragChunks: RagChunk[]
): SundayDocReference[] {
  const sundayChunks = ragChunks.filter(
    (c) => c.seminar_day === 'sunday' || c.search_phase === 'sunday_primary'
  )

  const refs: SundayDocReference[] = []
  const normalizedName = frequencyName.toLowerCase()

  for (const chunk of sundayChunks) {
    const normalizedContent = chunk.content.toLowerCase()

    if (normalizedContent.includes(normalizedName)) {
      // Extract a relevant quote around the frequency mention
      const quote = extractQuote(chunk.content, frequencyName)

      refs.push({
        filename: chunk.filename,
        section: chunk.title || 'Unknown Section',
        quote,
      })
    }
  }

  return refs
}

/**
 * Extract a relevant quote from content around the frequency mention
 */
function extractQuote(content: string, frequencyName: string): string {
  const normalizedName = frequencyName.toLowerCase()
  const normalizedContent = content.toLowerCase()

  const index = normalizedContent.indexOf(normalizedName)
  if (index === -1) {
    // Return first sentence if not found
    const firstSentence = content.split(/[.!?]/)[0]
    return firstSentence.slice(0, 150) + '...'
  }

  // Extract ~100 chars before and after the mention
  const start = Math.max(0, index - 100)
  const end = Math.min(content.length, index + frequencyName.length + 100)

  let quote = content.slice(start, end)

  // Clean up partial words at edges
  if (start > 0) {
    const firstSpace = quote.indexOf(' ')
    if (firstSpace > 0) {
      quote = '...' + quote.slice(firstSpace + 1)
    }
  }
  if (end < content.length) {
    const lastSpace = quote.lastIndexOf(' ')
    if (lastSpace > 0) {
      quote = quote.slice(0, lastSpace) + '...'
    }
  }

  return quote.trim()
}

/**
 * Build diagnostic triggers that led to this frequency recommendation
 */
function buildDiagnosticTriggers(
  freq: FrequencyWithReasoning,
  diagnosticData: DiagnosticDataSummary | null
): DiagnosticTrigger[] {
  const triggers: DiagnosticTrigger[] = []

  if (!diagnosticData) return triggers

  // Check if frequency rationale mentions specific diagnostic findings
  const rationale = (freq.rationale || '').toLowerCase()
  const diagnosticTrigger = (freq.diagnostic_trigger || '').toLowerCase()

  // D-Pulse deal breakers
  if (diagnosticData.dealBreakers.length > 0) {
    for (const dealBreaker of diagnosticData.dealBreakers) {
      if (
        rationale.includes(dealBreaker.toLowerCase()) ||
        diagnosticTrigger.includes(dealBreaker.toLowerCase())
      ) {
        triggers.push({
          type: 'd_pulse',
          finding: `${dealBreaker} - Deal Breaker (RED)`,
          value: 'Critical',
          interpretation: 'Must address before other protocols',
        })
      }
    }
  }

  // UA triggers
  if (diagnosticData.protocolTriggers.phLow) {
    if (rationale.includes('ph') || rationale.includes('acidic')) {
      triggers.push({
        type: 'urinalysis',
        finding: 'pH Low',
        value: diagnosticData.ua?.ph?.value?.toString() || '<6.0',
        interpretation: 'Recommend Cell Synergy or Trisalts',
      })
    }
  }

  if (diagnosticData.protocolTriggers.proteinPositive) {
    if (rationale.includes('protein')) {
      triggers.push({
        type: 'urinalysis',
        finding: 'Protein Positive',
        value: diagnosticData.ua?.protein?.value || 'Trace/Positive',
        interpretation: 'Recommend X39 patches',
      })
    }
  }

  // VCS triggers
  if (diagnosticData.protocolTriggers.vcsLow) {
    if (rationale.includes('vcs') || rationale.includes('biotoxin')) {
      triggers.push({
        type: 'vcs',
        finding: 'VCS Failed',
        value: 'Failed',
        interpretation: 'Biotoxin likely - Recommend Spectasol or Leptin settings',
      })
    }
  }

  // HRV patterns
  if (diagnosticData.hrv?.patterns) {
    if (diagnosticData.hrv.patterns.sympathetic_dominance) {
      if (rationale.includes('sympathetic') || rationale.includes('stress')) {
        triggers.push({
          type: 'hrv',
          finding: 'Sympathetic Dominance',
          value: `LF/HF: ${diagnosticData.hrv.lf_hf_ratio || 'elevated'}`,
          interpretation: 'Stress response overactive',
        })
      }
    }
    if (diagnosticData.hrv.patterns.parasympathetic_dominance) {
      if (rationale.includes('parasympathetic') || rationale.includes('vagus')) {
        triggers.push({
          type: 'hrv',
          finding: 'Parasympathetic Dominance',
          value: `LF/HF: ${diagnosticData.hrv.lf_hf_ratio || 'low'}`,
          interpretation: 'Rest/digest dominant',
        })
      }
    }
  }

  // If no specific triggers matched but we have diagnostic data, add general trigger
  if (triggers.length === 0 && freq.diagnostic_trigger) {
    triggers.push({
      type: 'general',
      finding: freq.diagnostic_trigger,
      value: 'See diagnostic files',
      interpretation: freq.rationale || 'Based on diagnostic findings',
    })
  }

  return triggers
}

/**
 * Calculate confidence score based on evidence quality
 */
function calculateConfidence(
  relevantChunks: RagChunk[],
  sundayRefs: SundayDocReference[],
  triggers: DiagnosticTrigger[]
): number {
  let score = 0.5 // Base score

  // Sunday doc references are highest weight (primary source)
  if (sundayRefs.length > 0) {
    score += 0.2 * Math.min(sundayRefs.length, 2) // Up to +0.4
  }

  // RAG chunks with high similarity
  const highSimilarityChunks = relevantChunks.filter((c) => c.similarity > 0.7)
  if (highSimilarityChunks.length > 0) {
    score += 0.1 * Math.min(highSimilarityChunks.length, 2) // Up to +0.2
  }

  // Diagnostic triggers
  if (triggers.length > 0) {
    score += 0.1 * Math.min(triggers.length, 2) // Up to +0.2
  }

  // Deal breaker triggers are highest confidence
  const dealBreakerTriggers = triggers.filter((t) => t.finding.includes('Deal Breaker'))
  if (dealBreakerTriggers.length > 0) {
    score += 0.1
  }

  return Math.min(score, 1.0) // Cap at 1.0
}
