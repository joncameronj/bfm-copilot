// Frequency Validator
// Validates frequency names against the approved list to prevent hallucination

import { createClient } from '@/lib/supabase/server'

export interface ValidationResult {
  valid: boolean
  frequencyName: string
  matchedApprovedName: string | null
  error: string | null
  matchType: 'exact' | 'alias' | 'fuzzy' | 'unverified' | 'none'
  rejectionReason?: 'hz_value' | 'not_in_approved_list' | null
}

export interface BatchValidationResult {
  validFrequencies: Array<{ original: string; approved: string }>
  rejectedFrequencies: ValidationResult[]
  validCount: number
  rejectedCount: number
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Validate a single frequency name against the approved list
 * CRITICAL: Hz values are NEVER allowed - only protocol names
 */
export async function validateFrequencyName(
  frequencyName: string,
  approvedList?: Array<{ name: string; aliases: string[] }>
): Promise<ValidationResult> {
  const normalizedInput = frequencyName.toLowerCase().trim()

  // CRITICAL SAFETY CHECK: Reject any Hz values
  // Patterns: "40/116", "40 Hz", "40Hz", "40.5/116.2", etc.
  const HZ_PATTERN = /\d+\.?\d*\s*\/\s*\d+\.?\d*|\d+\.?\d*\s*[Hh][Zz]/
  if (HZ_PATTERN.test(frequencyName)) {
    return {
      valid: false,
      frequencyName,
      matchedApprovedName: null,
      error: 'Hz values are not allowed - use protocol names only (e.g., "Liver Inflame")',
      matchType: 'none',
      rejectionReason: 'hz_value',
    }
  }

  const supabase = await createClient()

  // Fetch approved list if not provided
  let approvedFrequencies = approvedList
  if (!approvedFrequencies) {
    const { data } = await supabase
      .from('approved_frequency_names')
      .select('name, aliases')
      .eq('is_active', true)
    approvedFrequencies = data || []
  }

  // 1. Check for exact match
  const exactMatch = approvedFrequencies.find(
    (f) => f.name.toLowerCase().trim() === normalizedInput
  )
  if (exactMatch) {
    return {
      valid: true,
      frequencyName,
      matchedApprovedName: exactMatch.name,
      error: null,
      matchType: 'exact',
    }
  }

  // 2. Check aliases
  for (const freq of approvedFrequencies) {
    const aliasMatch = freq.aliases?.find(
      (alias) => alias.toLowerCase().trim() === normalizedInput
    )
    if (aliasMatch) {
      return {
        valid: true,
        frequencyName,
        matchedApprovedName: freq.name,
        error: null,
        matchType: 'alias',
      }
    }
  }

  // 3. Fuzzy match for typos (Levenshtein distance <= 2)
  const FUZZY_THRESHOLD = 2
  let closestMatch: { name: string; distance: number } | null = null

  for (const freq of approvedFrequencies) {
    const distance = levenshteinDistance(normalizedInput, freq.name.toLowerCase())
    if (distance <= FUZZY_THRESHOLD) {
      if (!closestMatch || distance < closestMatch.distance) {
        closestMatch = { name: freq.name, distance }
      }
    }

    // Also check aliases for fuzzy match
    for (const alias of freq.aliases || []) {
      const aliasDistance = levenshteinDistance(normalizedInput, alias.toLowerCase())
      if (aliasDistance <= FUZZY_THRESHOLD) {
        if (!closestMatch || aliasDistance < closestMatch.distance) {
          closestMatch = { name: freq.name, distance: aliasDistance }
        }
      }
    }
  }

  if (closestMatch) {
    return {
      valid: true,
      frequencyName,
      matchedApprovedName: closestMatch.name,
      error: null,
      matchType: 'fuzzy',
    }
  }

  // No match found — keep as unverified (soft pass) instead of hard-rejecting.
  // Hz values are still hard-rejected above. This prevents valid protocols
  // from being dropped just because they're not yet in the approved_frequency_names table.
  console.warn(
    `[Frequency Validation] "${frequencyName}" not in approved list — keeping as unverified`
  )
  return {
    valid: true,
    frequencyName,
    matchedApprovedName: frequencyName, // Use original name as-is
    error: `Frequency "${frequencyName}" not found in approved list (kept as unverified)`,
    matchType: 'unverified',
    rejectionReason: 'not_in_approved_list',
  }
}

/**
 * Validate multiple frequency names in batch
 */
export async function validateAllFrequencies(
  frequencies: Array<{ name: string }>
): Promise<BatchValidationResult> {
  const supabase = await createClient()

  // Fetch approved list once
  const { data: approvedList } = await supabase
    .from('approved_frequency_names')
    .select('name, aliases')
    .eq('is_active', true)

  const results = await Promise.all(
    frequencies.map((f) => validateFrequencyName(f.name, approvedList || []))
  )

  const validFrequencies = results
    .filter((r) => r.valid)
    .map((r) => ({ original: r.frequencyName, approved: r.matchedApprovedName! }))

  const rejectedFrequencies = results.filter((r) => !r.valid)

  return {
    validFrequencies,
    rejectedFrequencies,
    validCount: validFrequencies.length,
    rejectedCount: rejectedFrequencies.length,
  }
}

/**
 * Filter out invalid frequencies from a protocol and return validation report
 */
export async function filterAndValidateProtocol(
  protocol: {
    title: string
    frequencies: Array<{ name: string; rationale?: string; source_reference?: string }>
  }
): Promise<{
  filteredProtocol: typeof protocol
  validationReport: BatchValidationResult
}> {
  const validation = await validateAllFrequencies(protocol.frequencies)

  // Keep only valid frequencies
  const filteredFrequencies = protocol.frequencies.filter((f) =>
    validation.validFrequencies.some((v) => v.original === f.name)
  )

  // Update names to use the canonical approved name
  const updatedFrequencies = filteredFrequencies.map((f) => {
    const match = validation.validFrequencies.find((v) => v.original === f.name)
    return {
      ...f,
      name: match?.approved || f.name,
    }
  })

  return {
    filteredProtocol: {
      ...protocol,
      frequencies: updatedFrequencies,
    },
    validationReport: validation,
  }
}

/**
 * Log validation failures for admin review
 */
export async function logValidationFailures(
  analysisId: string,
  failures: ValidationResult[]
): Promise<void> {
  if (failures.length === 0) return

  const supabase = await createClient()

  // Log to a simple usage_events table for now
  // In production, you might want a dedicated validation_logs table
  await supabase.from('usage_events').insert({
    user_id: null, // Will be set by RLS
    event_type: 'protocol_feedback_submitted', // Reusing existing event type
    metadata: {
      type: 'frequency_validation_failures',
      analysis_id: analysisId,
      failures: failures.map((f) => ({
        frequency: f.frequencyName,
        error: f.error,
      })),
      failure_count: failures.length,
      timestamp: new Date().toISOString(),
    },
  })
}

// ============================================
// CROSS-PROTOCOL FREQUENCY DEDUPLICATION
// ============================================

export interface DeduplicationLogEntry {
  frequencyName: string
  keptInProtocol: string
  removedFromProtocols: string[]
  mergedRationales: string[]
  finalRationale: string
}

export interface DeduplicationResult {
  deduplicatedProtocols: Array<{
    title: string
    description: string
    category: string
    frequencies: Array<{ id: string; name: string; rationale?: string }>
    priority: number
    validationReport?: BatchValidationResult
  }>
  deduplicationLog: DeduplicationLogEntry[]
  totalDeduplicated: number
}

/**
 * Deduplicate frequencies across all protocols.
 * - Each frequency name appears only ONCE in the entire analysis
 * - When same frequency appears with different rationales, merge them with semicolon
 * - Keep the frequency in whichever protocol it appeared first (by priority order)
 */
export function deduplicateFrequenciesAcrossProtocols(
  protocols: Array<{
    title: string
    description: string
    category: string
    frequencies: Array<{ id: string; name: string; rationale?: string }>
    priority: number
    validationReport?: BatchValidationResult
  }>
): DeduplicationResult {
  // Sort protocols by priority (lower number = higher priority = appears first)
  const sortedProtocols = [...protocols].sort((a, b) => a.priority - b.priority)

  // Track seen frequencies: normalizedName -> { protocolIndex, rationales[], originalName, frequencyId }
  const seenFrequencies = new Map<
    string,
    {
      protocolTitle: string
      protocolIndex: number
      rationales: string[]
      originalName: string
      frequencyId: string
    }
  >()

  // First pass: collect all occurrences and their rationales
  for (const [idx, protocol] of sortedProtocols.entries()) {
    for (const freq of protocol.frequencies) {
      const normalizedName = freq.name.toLowerCase().trim()

      if (!seenFrequencies.has(normalizedName)) {
        // First occurrence - track it
        seenFrequencies.set(normalizedName, {
          protocolTitle: protocol.title,
          protocolIndex: idx,
          rationales: freq.rationale ? [freq.rationale] : [],
          originalName: freq.name,
          frequencyId: freq.id,
        })
      } else {
        // Duplicate - collect the rationale for merging (skip if empty or already exists)
        const existing = seenFrequencies.get(normalizedName)!
        if (freq.rationale && !existing.rationales.includes(freq.rationale)) {
          existing.rationales.push(freq.rationale)
        }
      }
    }
  }

  // Track which protocols had frequencies removed (for logging)
  const frequencyRemovals = new Map<string, string[]>()

  // Second pass: build deduplicated protocols with merged rationales
  const deduplicatedProtocols = sortedProtocols.map((protocol, idx) => {
    const deduplicatedFrequencies: Array<{ id: string; name: string; rationale?: string }> = []

    for (const freq of protocol.frequencies) {
      const normalizedName = freq.name.toLowerCase().trim()
      const entry = seenFrequencies.get(normalizedName)!

      // Only keep the frequency in the protocol where it first appeared
      if (entry.protocolIndex === idx) {
        // Merge rationales with semicolon separator
        const mergedRationale =
          entry.rationales.length > 1
            ? entry.rationales.join('; ')
            : entry.rationales[0] || ''

        deduplicatedFrequencies.push({
          id: freq.id,
          name: freq.name,
          rationale: mergedRationale || undefined,
        })
      } else {
        // Track this removal for logging
        if (!frequencyRemovals.has(normalizedName)) {
          frequencyRemovals.set(normalizedName, [])
        }
        frequencyRemovals.get(normalizedName)!.push(protocol.title)
      }
    }

    return {
      ...protocol,
      frequencies: deduplicatedFrequencies,
    }
  })

  // Build deduplication log
  const deduplicationLog: DeduplicationLogEntry[] = []

  for (const [normalizedName, removals] of frequencyRemovals) {
    if (removals.length > 0) {
      const entry = seenFrequencies.get(normalizedName)!
      const finalRationale =
        entry.rationales.length > 1
          ? entry.rationales.join('; ')
          : entry.rationales[0] || ''

      deduplicationLog.push({
        frequencyName: entry.originalName,
        keptInProtocol: entry.protocolTitle,
        removedFromProtocols: removals,
        mergedRationales: entry.rationales,
        finalRationale,
      })
    }
  }

  // Calculate total deduplicated count
  const totalDeduplicated = Array.from(frequencyRemovals.values()).reduce(
    (sum, removals) => sum + removals.length,
    0
  )

  return {
    deduplicatedProtocols,
    deduplicationLog,
    totalDeduplicated,
  }
}
