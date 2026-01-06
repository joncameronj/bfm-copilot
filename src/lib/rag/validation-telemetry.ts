// Validation Telemetry Logger
// Logs all frequency validation decisions for admin review and RAG improvement

import { createClient } from '@/lib/supabase/server'
import type { BatchValidationResult, ValidationResult } from './frequency-validator'

// ============================================
// TYPES
// ============================================

interface TelemetryContext {
  diagnosticUploadId: string
  analysisId?: string
}

interface TelemetryLogEntry {
  diagnostic_upload_id: string
  analysis_id?: string
  attempted_frequency: string
  validation_result: string
  matched_to: string | null
  fuzzy_distance?: number
  ai_rationale?: string
  rag_context_snippet?: string
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Log validation results for admin telemetry
 * This helps identify hallucination patterns and improve RAG/prompts
 */
export async function logValidationTelemetry(
  context: TelemetryContext,
  validationReport: BatchValidationResult,
  aiRationales?: Map<string, string>,
  ragContextSnippet?: string
): Promise<void> {
  const supabase = await createClient()
  const logs: TelemetryLogEntry[] = []

  // Log successful validations
  for (const valid of validationReport.validFrequencies) {
    const matchType = valid.original.toLowerCase().trim() === valid.approved.toLowerCase().trim()
      ? 'exact_match'
      : 'alias_match' // Could also be fuzzy_match, but we'll simplify for now

    logs.push({
      diagnostic_upload_id: context.diagnosticUploadId,
      analysis_id: context.analysisId,
      attempted_frequency: valid.original,
      validation_result: matchType,
      matched_to: valid.approved,
      ai_rationale: aiRationales?.get(valid.original),
      rag_context_snippet: ragContextSnippet?.slice(0, 500),
    })
  }

  // Log rejections (CRITICAL for admin review)
  for (const rejected of validationReport.rejectedFrequencies) {
    logs.push({
      diagnostic_upload_id: context.diagnosticUploadId,
      analysis_id: context.analysisId,
      attempted_frequency: rejected.frequencyName,
      validation_result: mapRejectionReason(rejected),
      matched_to: null,
      ai_rationale: aiRationales?.get(rejected.frequencyName),
      rag_context_snippet: ragContextSnippet?.slice(0, 500),
    })
  }

  // Batch insert logs
  if (logs.length > 0) {
    const { error } = await supabase.from('frequency_validation_logs').insert(logs)
    if (error) {
      console.error('[Validation Telemetry] Failed to log:', error)
    }
  }
}

/**
 * Map rejection reason to telemetry category
 */
function mapRejectionReason(result: ValidationResult): string {
  if (result.rejectionReason === 'hz_value') {
    return 'rejected_hz'
  }
  return 'rejected_unknown'
}

// ============================================
// ADMIN STATS FUNCTIONS
// ============================================

/**
 * Get validation stats for admin dashboard
 */
export async function getValidationStats(
  days: number = 30
): Promise<{
  total: number
  passed: number
  rejected: number
  rejectionRate: number
  byResult: Record<string, number>
}> {
  const supabase = await createClient()

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const { data, error } = await supabase
    .from('frequency_validation_logs')
    .select('validation_result')
    .gte('created_at', cutoff.toISOString())

  if (error || !data) {
    console.error('[Validation Telemetry] Failed to get stats:', error)
    return { total: 0, passed: 0, rejected: 0, rejectionRate: 0, byResult: {} }
  }

  const byResult: Record<string, number> = {}
  let passed = 0
  let rejected = 0

  for (const row of data) {
    byResult[row.validation_result] = (byResult[row.validation_result] || 0) + 1

    if (row.validation_result.startsWith('rejected')) {
      rejected++
    } else {
      passed++
    }
  }

  const total = data.length
  const rejectionRate = total > 0 ? rejected / total : 0

  return { total, passed, rejected, rejectionRate, byResult }
}

/**
 * Get top rejected frequencies (candidates for approved list)
 */
export async function getTopRejectedFrequencies(
  limit: number = 20
): Promise<
  Array<{
    frequency: string
    count: number
    sampleRationale: string | null
    sampleContext: string | null
  }>
> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('top_rejected_frequencies')
    .select('*')
    .limit(limit)

  if (error || !data) {
    console.error('[Validation Telemetry] Failed to get top rejected:', error)
    return []
  }

  return data.map((row) => ({
    frequency: row.attempted_frequency,
    count: row.rejection_count,
    sampleRationale: row.sample_rationale,
    sampleContext: row.sample_context,
  }))
}

/**
 * Get Hz rejection attempts (indicates prompt issues)
 */
export async function getHzRejectionCount(days: number = 30): Promise<number> {
  const supabase = await createClient()

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const { count, error } = await supabase
    .from('frequency_validation_logs')
    .select('*', { count: 'exact', head: true })
    .eq('validation_result', 'rejected_hz')
    .gte('created_at', cutoff.toISOString())

  if (error) {
    console.error('[Validation Telemetry] Failed to get Hz rejections:', error)
    return 0
  }

  return count || 0
}
