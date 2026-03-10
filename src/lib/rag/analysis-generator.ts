// Diagnostic Analysis Generator with RAG
// Generates protocol recommendations in "Dr. Rob's voice"
// Uses Sunday-first RAG search and frequency name validation

import { createClient } from '@/lib/supabase/server'
import { getAnthropicClient, extractJSON, JSON_SYSTEM_SUFFIX } from '@/lib/anthropic'
import { getPythonAgentUrl } from '@/lib/agent/url'
import { getDefaultChatModel } from '@/lib/ai/provider'
import {
  filterAndValidateProtocol,
  deduplicateFrequenciesAcrossProtocols,
  type BatchValidationResult,
} from './frequency-validator'
import { logValidationTelemetry } from './validation-telemetry'
import { checkDemoMode } from '@/lib/demo-mode'
import type { RecommendedFrequency, Supplementation } from '@/types/diagnostic-analysis'
import type { DiagnosticDataSummary } from '@/types/diagnostic-extraction'

// ============================================
// DR. ROB VOICE SYSTEM PROMPTS
// ============================================

const DR_ROB_PRACTITIONER_PROMPT = `You are speaking as Dr. Rob, an expert in Frequency Specific Microcurrent (FSM) and integrative medicine. You are providing analysis to a practitioner.

When explaining findings:
- Use clear, professional language with medical accuracy
- Include helpful analogies to explain complex concepts
- Connect symptoms to underlying causes based on the diagnostic data
- Reference FSM protocols by NAME (not Hz values)
- Be confident and direct in your recommendations

CRITICAL FREQUENCY RULES (STRICT ENFORCEMENT):
1. You may ONLY recommend frequencies from the APPROVED FREQUENCY LIST provided below
2. Output frequency NAMES ONLY - NEVER include Hz values (like "40/116", "40 Hz", or any numbers)
3. EXAMPLES of CORRECT output: "Liver Inflame", "Thyroid 1", "PNS Support", "Mito Tox"
4. EXAMPLES of WRONG output: "40/116", "Inflammation 40 Hz", "40/89 for liver" - NEVER DO THIS
5. If you cannot find an appropriate approved frequency, DO NOT recommend anything for that finding
6. NEVER invent, hallucinate, or guess frequency names - ONLY use exact names from the approved list
7. Any frequency not on the approved list will be REJECTED by the system

DIAGNOSTIC ANALYSIS ORDER:
1. First look at HRV patterns - what's off in autonomic function?
2. Then brainwave patterns - what FSM protocols does this indicate?
3. Then D-Pulse - identify "seven deal breakers" (critical red markers)
4. Then UA (urinalysis): pH low → Cell Synergy/Trisalts; Protein off → X39 patches
5. Then VCS: if failed → Pectasol-C or Leptin settings
6. Finally Labs → supplementation recommendations

Structure your response as JSON with the following format:
{
  "summary": "A comprehensive explanation of what the diagnostics reveal about the patient's condition. Use analogies where helpful. This should be 2-4 paragraphs.",
  "protocols": [
    {
      "title": "Protocol name",
      "description": "Brief description of what this protocol addresses",
      "category": "general|detox|hormone|gut|immune|metabolic|neurological",
      "frequencies": [
        {
          "name": "EXACT name from APPROVED FREQUENCY LIST only (e.g., 'Liver Inflame', 'PNS Support') - NO Hz values",
          "rationale": "Why this frequency is recommended based on diagnostic findings",
          "source_reference": "Which BFM Sunday document section led to this recommendation",
          "diagnostic_trigger": "Which specific diagnostic finding triggered this (e.g., 'ALT elevated', 'Heart RED on D-Pulse')"
        }
      ],
      "priority": 1,
      "layer": 1,
      "layer_label": "High Priorities"
    }
  ],
  "supplementation": [
    {
      "name": "Supplement name",
      "dosage": "Recommended dosage",
      "timing": "When to take",
      "rationale": "Why this is recommended based on the data",
      "layer": 1
    }
  ],
  "reasoning_chain": [
    "Step 1: What the HRV showed...",
    "Step 2: What the D-Pulse deal breakers indicated...",
    "Step 3: How this led to protocol selection..."
  ]
}

LAYERED PROTOCOL SYSTEM — assign every protocol and supplement to a layer:
- Layer 1 ("High Priorities"): Deal breakers + primary in-office protocols + Day 1 supplements (Cell Synergy, Tri-Salts, Pectasol-C, X-39, Serculate, CoQ10, Vagus Nerve, Deuterium Drops if specific gravity ≤1.005). Set priority=1, layer=1, layer_label="High Priorities".
- Layer 2 ("Next If No Response"): Condition-specific protocols (Thyroid, Hormone, Gut, Liver) + lab-triggered supplements (Vitamin D, IP6 Gold, Homocysteine Factor, Adipothin, Livergy, Pancreos). Set priority=2, layer=2, layer_label="Next If No Response".
- Layer 3 ("If They Are Still Stuck"): Experimental protocols (EMF Cord, Deuterium frequency for high deuterium >130ppm) + advanced detox + advanced supplements (Epi Pineal, Hypothala, Rejuvenation H2, Fatty 15). Set priority=3, layer=3, layer_label="If They Are Still Stuck".

EVAL-TRAINED CLINICAL DECISION RULES (from Dr. Rob's review — apply strictly):

AUTONOMIC PATTERN CLASSIFICATION (most common error — get this right):
- SNS SWITCHED (upper-left quadrant, SNS clearly elevated): → SNS Balance (35@709)
- LOWER-LEFT QUADRANT (both SNS and PNS depleted): → MIDBRAIN SUPPORT, NOT SNS Balance
- RED DOT ON BLUE DOT (fight/flight freeze): → LOCUS COERULEUS + SNS Balance
- PNS NEGATIVE ONLY (no SNS switch): → PNS Support + Vagus Support, NOT SNS Balance
- HIGH BARORECEPTOR SENSITIVITY: → CSF SUPPORT frequency

VAGUS ORDER (non-negotiable): Vagus Support FIRST → Vagus Balance (if SNS also switched) → Vagus Trauma ONLY if insufficient
NEVER start with Vagus Trauma. NEVER reverse this order.

CELL SYNERGY: Standard = 1 scoop. Double = 2 scoops (NOT 4). Only double for "BE MORE ATTENTIVE" or extreme Alpha/Theta ratio.

X-39: ALWAYS Day 1 for ALL patients. Never push to Week 3-4.

SUPPLEMENT PHASING (Day 1 = in-office ONLY, Week 1-2 = lab ONLY):
- Day 1: Cell Synergy, Tri-Salts (pH<6.2 only), Pectasol-C (VCS fail), Serculate (Heart low), CoQ10 (Heart low), X-39 (ALL), Innovita Vagus (vagus DB), D-Ribose (Alpha/Theta DB), Deuterium Drops (SG≤1.005)
- Week 1-2: Vitamin D, IP6 Gold, Homocysteine Factor, Adipothin, Livergy, Pancreos, Kidney Clear — ONLY with lab confirmation
- DO NOT recommend Vitamin D, Integra Cell, or lab-dependent supplements without lab results

VCS → LEPTIN → MSH GATING: VCS fail → address Leptin FIRST (Biotoxin + Leptin Resist + Adipothin), THEN MSH (Pit A Support, Pars Intermedia). Never jump to MSH before Leptin.

LAB RETEST: 3 months for bloodwork (NOT 6 weeks). In-office retest: every 2-4 weeks.

FAKE FREQUENCIES TO NEVER USE: "Brain Activity Support", "Stress Index Regulation", "Cervical Support", "Stress Response Support", "Energy Restoration" — NONE of these exist.

Guidelines for protocols:
- Recommend the MINIMAL VIABLE protocol set based on highest-signal diagnostic findings (typically 2-4; only add more when clearly justified by extracted diagnostics)
- Each protocol should have 1-3 relevant FSM frequencies (NAMES ONLY from approved list)
- Prioritize protocols based on deal breakers and critical findings (1 = most important)
- Include supplementation based on ALL diagnostic findings (HRV, D-Pulse, UA, VCS)
- When labs are available, add additional supplement recommendations based on blood markers
- Base all recommendations on BFM Sunday documentation first; use non-Sunday chunks only as secondary support when Sunday evidence is insufficient
- ALWAYS cite which document section supports each recommendation`

const DR_ROB_MEMBER_PROMPT = `You are speaking as Dr. Rob, an expert in integrative wellness. You are providing EDUCATIONAL information to a program member.

CRITICAL COMPLIANCE RULES:
- You are providing EDUCATIONAL information only
- NEVER provide treatment advice, protocols, or therapeutic recommendations
- If asked about treatment, respond: "For treatment guidance, please consult with your practitioner or refer to your program materials."
- Always focus on explaining what the diagnostics show, not what to do about it
- Reference their enrolled program/course for next steps

Structure your response as JSON with the following format:
{
  "summary": "An educational explanation of what the diagnostics reveal. Use accessible language and helpful analogies. Explain the significance of findings without prescribing treatments. This should be 2-4 paragraphs. End with a note to consult their practitioner or program materials for guidance.",
  "insights": [
    {
      "title": "Insight title",
      "description": "Educational explanation of this finding",
      "category": "general|nutrition|lifestyle|wellness"
    }
  ],
  "disclaimer": "This information is for educational purposes only and is not medical advice. Please consult with your practitioner for personalized treatment recommendations."
}`

// ============================================
// TYPES
// ============================================

interface PatientContext {
  id: string
  firstName: string
  lastName: string
  gender: string
  dateOfBirth: string
  chiefComplaints: string | null
  medicalHistory: string | null
  currentMedications: string[] | null
  allergies: string[] | null
}

interface DiagnosticFile {
  id: string
  filename: string
  fileType: string
  content?: string  // Extracted text content
}

interface RagChunk {
  chunk_id: string
  document_id: string
  content: string
  title: string | null
  filename: string
  similarity: number
  care_category?: string
  document_category?: string
  seminar_day?: string
  search_phase?: string  // 'sunday_primary' | 'seminar_secondary' | 'frequency_reference' | 'supplementary'
  priority_rank?: number
}

const FALLBACK_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'your', 'their',
  'have', 'has', 'are', 'was', 'were', 'been', 'into', 'over', 'under',
  'diagnostic', 'diagnostics', 'patient', 'patients', 'analysis', 'findings',
  'recommendation', 'recommendations', 'protocol', 'protocols', 'file', 'files',
  'data', 'report', 'reports', 'result', 'results',
])

function extractFallbackKeywords(query: string, maxKeywords: number = 8): string[] {
  const rawWords = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !FALLBACK_STOP_WORDS.has(word))

  const uniqueWords: string[] = []
  for (const word of rawWords) {
    if (!uniqueWords.includes(word)) {
      uniqueWords.push(word)
    }
    if (uniqueWords.length >= maxKeywords) {
      break
    }
  }

  return uniqueWords
}

async function keywordFallbackSearch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  queryText: string,
  userRole: 'practitioner' | 'member',
  limit: number
): Promise<RagChunk[]> {
  const keywords = extractFallbackKeywords(queryText)
  if (!keywords.length) {
    return []
  }

  const orClause = keywords.map((keyword) => `content.ilike.%${keyword}%`).join(',')

  const { data, error } = await supabase
    .from('document_chunks')
    .select(`
      id,
      document_id,
      content,
      documents!inner(
        title,
        filename,
        care_category,
        document_category,
        role_scope,
        seminar_day,
        status
      )
    `)
    .or(orClause)
    .limit(limit * 4)

  if (error || !data) {
    console.error('[RAG] Keyword fallback query failed:', error)
    return []
  }

  const allowedRoleScopes =
    userRole === 'practitioner'
      ? new Set(['clinical', 'both'])
      : new Set(['educational', 'both'])

  const scoredRows = (data as Array<Record<string, unknown>>)
    .map((row) => {
      const documentData = row.documents as
        | Record<string, unknown>
        | Array<Record<string, unknown>>
        | null
      const document = Array.isArray(documentData)
        ? documentData[0] || null
        : documentData
      const content = String(row.content || '')
      const normalizedContent = content.toLowerCase()
      const keywordHits = keywords.reduce(
        (count, keyword) => (normalizedContent.includes(keyword) ? count + 1 : count),
        0
      )
      const sundayBoost = document?.seminar_day === 'sunday' ? 0.2 : 0
      const score = keywordHits + sundayBoost

      return { row, document, score }
    })
    .filter(({ document, score }) => {
      if (!document || score <= 0) return false
      const status = String(document.status || '')
      if (status !== 'indexed' && status !== 'completed') return false
      const roleScope = String(document.role_scope || 'educational')
      return allowedRoleScopes.has(roleScope)
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return scoredRows.map(({ row, document, score }) => ({
    chunk_id: String(row.id),
    document_id: String(row.document_id),
    content: String(row.content || ''),
    title: (document?.title as string | null) || null,
    filename: String(document?.filename || 'unknown'),
    similarity: Math.min(0.95, 0.25 + score * 0.08),
    care_category: (document?.care_category as string | undefined) || undefined,
    document_category: (document?.document_category as string | undefined) || undefined,
    seminar_day: (document?.seminar_day as string | undefined) || undefined,
    search_phase: 'keyword_fallback',
    priority_rank: undefined,
  }))
}

interface ProtocolEngineResult {
  protocols: Array<{
    name: string
    priority: number
    trigger: string
    category: string
    notes: string
  }>
  supplements: Array<{
    name: string
    trigger: string
    dosage: string
    timing: string
    notes: string
  }>
  deal_breakers: string[]
  cross_correlations: string[]
}

interface GeneratedAnalysis {
  summary: string
  protocols: Array<{
    title: string
    description: string
    category: string
    frequencies: RecommendedFrequency[]
    priority: number
  }>
  supplementation: Supplementation[]
  ragContext: RagChunk[]
  reasoningChain: string[]
  extractedData: DiagnosticDataSummary | null
}

function getAnalysisModel(): string {
  return getDefaultChatModel()
}

// ============================================
// MAIN ANALYSIS GENERATOR
// ============================================

export async function generateDiagnosticAnalysis(
  diagnosticUploadId: string,
  patientId: string,
  practitionerId: string,
  userRole: 'practitioner' | 'member' = 'practitioner'
): Promise<GeneratedAnalysis> {
  const supabase = await createClient()

  // 1. Get patient context
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('id, first_name, last_name, gender, date_of_birth, chief_complaints, medical_history, current_medications, allergies')
    .eq('id', patientId)
    .single()

  if (patientError || !patient) {
    throw new Error('Patient not found')
  }

  const patientContext: PatientContext = {
    id: patient.id,
    firstName: patient.first_name,
    lastName: patient.last_name,
    gender: patient.gender,
    dateOfBirth: patient.date_of_birth,
    chiefComplaints: patient.chief_complaints,
    medicalHistory: patient.medical_history,
    currentMedications: patient.current_medications,
    allergies: patient.allergies,
  }

  // 2. Get diagnostic files
  const { data: diagnosticFilesRaw, error: filesError } = await supabase
    .from('diagnostic_files')
    .select('id, filename, file_type')
    .eq('upload_id', diagnosticUploadId)

  if (filesError) {
    throw new Error('Failed to fetch diagnostic files')
  }

  // Map snake_case to camelCase
  const diagnosticFiles: DiagnosticFile[] = (diagnosticFilesRaw || []).map((f) => ({
    id: f.id,
    filename: f.filename,
    fileType: f.file_type,
  }))

  // 2a. Check for demo mode - return hard-coded response for case study files
  const demoResponse = await checkDemoMode(supabase, diagnosticFiles)
  if (demoResponse) {
    // Get extracted data to include in response
    const extractedData = await getExtractedDiagnosticData(diagnosticUploadId, supabase)
    return {
      ...demoResponse,
      ragContext: [], // No RAG context in demo mode
      extractedData,
    }
  }

  // 3. Check if patient has existing labs in lab_results table
  const { data: labResults } = await supabase
    .from('lab_results')
    .select('id, test_date, ominous_count')
    .eq('patient_id', patientId)
    .order('test_date', { ascending: false })
    .limit(1)

  const hasExistingLabResults = Boolean(labResults && labResults.length > 0)

  // 4. Fetch extracted diagnostic values (from Vision API)
  const extractedData = await getExtractedDiagnosticData(diagnosticUploadId, supabase)

  // 5. Run deterministic protocol engine on extracted data
  // This is the PRIMARY source of protocol decisions — the AI only explains/sequences
  let engineResult: ProtocolEngineResult | null = null
  if (extractedData) {
    try {
      const engineResponse = await fetch(`${getPythonAgentUrl()}/agent/protocols/engine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extracted_data: extractedData }),
      })
      if (engineResponse.ok) {
        engineResult = await engineResponse.json() as ProtocolEngineResult
        console.log(
          `[Protocol Engine] Found ${engineResult.protocols.length} protocols, ` +
          `${engineResult.supplements.length} supplements, ` +
          `${engineResult.deal_breakers.length} deal breakers`
        )
      } else {
        console.warn(`[Protocol Engine] Failed: ${engineResponse.status} ${engineResponse.statusText}`)
      }
    } catch (engineError) {
      console.warn('[Protocol Engine] Unavailable, falling back to AI-only:', engineError)
    }
  }

  // 6. Determine if we have lab data for supplementation recommendations
  // Include labs if either:
  // - Patient has existing lab_results records, OR
  // - This diagnostic upload includes extracted blood panel data
  const hasExtractedBloodPanel = extractedData?.bloodPanel !== null
  const hasLabs = hasExistingLabResults || hasExtractedBloodPanel

  // 7. Build query for RAG search
  const queryText = buildSearchQuery(patientContext, diagnosticFiles, extractedData)

  // 8. Perform RAG search via Python agent (single source of truth)
  // This ensures consistent search behavior across chat and diagnostic analysis
  const pythonAgentUrl = getPythonAgentUrl()

  let ragChunks: RagChunk[] = []

  try {
    const ragResponse = await fetch(`${pythonAgentUrl}/agent/rag/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: queryText,
        user_id: practitionerId,
        user_role: userRole,
        limit: 15,
        threshold: 0.40, // Lowered to improve recall
        include_related: true,
        enforce_sunday_first: true,
      }),
    })

    if (!ragResponse.ok) {
      throw new Error(`RAG search failed: ${ragResponse.status} ${ragResponse.statusText}`)
    }

    const ragData = await ragResponse.json()

    // Convert Python agent response to RagChunk format
    ragChunks = (ragData.results || []).map((r: Record<string, unknown>) => ({
      chunk_id: (r.chunk_id as string | undefined) || '',
      document_id: (r.document_id as string | undefined) || '',
      content: r.content as string,
      title: r.title as string | null,
      filename: r.filename as string,
      similarity: r.similarity as number,
      care_category: undefined,
      document_category: r.document_category as string | undefined,
      seminar_day: r.seminar_day as string | undefined,
      search_phase: (r.search_phase as string | undefined)
        || ((r.seminar_day as string | undefined) === 'sunday'
          ? 'sunday_primary'
          : (r.seminar_day as string | undefined)
            ? 'seminar_secondary'
            : undefined),
      priority_rank: undefined,
    }))

    console.log(`[RAG] Python agent returned ${ragChunks.length} results for diagnostic analysis`)
  } catch (ragError) {
    console.error('Python agent RAG search error:', ragError)

    // Fallback to Supabase keyword search if Python agent fails.
    // This avoids reliance on external embedding generation.
    console.warn('Falling back to Supabase keyword search for RAG')
    try {
      ragChunks = await keywordFallbackSearch(
        supabase,
        queryText,
        userRole,
        15
      )
      console.log(`[RAG] Keyword fallback returned ${ragChunks.length} results`)
    } catch (fallbackError) {
      console.error(
        '[RAG] Keyword fallback search failed; continuing without RAG context:',
        fallbackError
      )
      ragChunks = []
    }
  }

  const sundayChunkCount = ragChunks.filter(
    (chunk) => chunk.seminar_day === 'sunday' || chunk.search_phase === 'sunday_primary'
  ).length
  if (ragChunks.length > 0 && sundayChunkCount === 0) {
    console.warn(
      `[RAG] Sunday-first fallback engaged for diagnostic upload ${diagnosticUploadId}. ` +
      `Using secondary seminar chunks due to insufficient Sunday evidence. Query: ${queryText}`
    )
  } else if (ragChunks.length === 0) {
    console.warn(
      `[RAG] No RAG chunks returned for diagnostic upload ${diagnosticUploadId}. Query: ${queryText}`
    )
  }

  // 9. Fetch APPROVED frequency names (for validation)
  const { data: approvedFrequencies } = await supabase
    .from('approved_frequency_names')
    .select('name, aliases, category')
    .eq('is_active', true)

  const approvedFrequencyNames = (approvedFrequencies || []).flatMap(f => [
    f.name,
    ...(f.aliases || []),
  ])

  // 10. Get FSM frequencies for reference (legacy, may be removed)
  const { data: fsmFrequencies } = await supabase
    .from('fsm_frequencies')
    .select('id, name, frequency_a, frequency_b, category, condition, description')
    .eq('is_active', true)

  // 11. Generate analysis with AI (protocol engine results used as primary source)
  const analysis = await callAIForAnalysis(
    patientContext,
    diagnosticFiles,
    ragChunks,
    fsmFrequencies || [],
    hasLabs,
    userRole,
    extractedData,
    approvedFrequencyNames,
    diagnosticUploadId,
    engineResult
  )

  return {
    ...analysis,
    ragContext: ragChunks,
    extractedData,
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function buildSearchQuery(
  patient: PatientContext,
  files: DiagnosticFile[],
  extractedData: DiagnosticDataSummary | null
): string {
  const parts: string[] = []

  // PRIORITY: Add deal breakers and critical findings from extracted data
  if (extractedData?.dealBreakers && extractedData.dealBreakers.length > 0) {
    parts.push(`Critical deal breakers: ${extractedData.dealBreakers.join(', ')}`)
  }

  // Add findings from extracted diagnostics
  if (extractedData?.findings && extractedData.findings.length > 0) {
    parts.push(`Diagnostic findings: ${extractedData.findings.slice(0, 5).join(', ')}`)
  }

  // Add HRV pattern information
  if (extractedData?.hrv?.findings && extractedData.hrv.findings.length > 0) {
    parts.push(`HRV patterns: ${extractedData.hrv.findings.join(', ')}`)
  }

  // Add protocol triggers
  if (extractedData?.protocolTriggers) {
    const triggers: string[] = []
    if (extractedData.protocolTriggers.phLow) triggers.push('pH low - cell synergy or trisalts')
    if (extractedData.protocolTriggers.proteinPositive) triggers.push('protein positive - X39 patches')
    if (extractedData.protocolTriggers.vcsLow) triggers.push('VCS failed - biotoxin illness, elevated cytokines, leptin resistance')
    if (triggers.length > 0) {
      parts.push(`Protocol triggers: ${triggers.join(', ')}`)
    }
  }

  // Add seven deal breakers search term for D-Pulse
  if (files.some(f => f.fileType === 'd_pulse')) {
    parts.push('seven deal breakers D-Pulse energy assessment')
  }

  // NOTE: Chief complaints intentionally NOT included in search query
  // Per Issue 4: Protocols should be driven by diagnostic data, not subjective complaints

  // Add medical history
  if (patient.medicalHistory) {
    parts.push(`Medical history includes: ${patient.medicalHistory}`)
  }

  // Add diagnostic file types
  const fileTypes = files.map(f => f.fileType).join(', ')
  if (fileTypes) {
    parts.push(`Diagnostic files: ${fileTypes}`)
  }

  // Default query if no context
  if (parts.length === 0) {
    parts.push('FSM frequency protocols for general health assessment')
  }

  return parts.join('. ')
}

/**
 * Fetch extracted diagnostic values from Vision API processing
 */
async function getExtractedDiagnosticData(
  diagnosticUploadId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<DiagnosticDataSummary | null> {
  try {
    // Get all files and their extracted values
    const { data: files, error } = await supabase
      .from('diagnostic_files')
      .select(`
        id,
        file_type,
        filename,
        diagnostic_extracted_values(
          extracted_data,
          extraction_confidence,
          status
        )
      `)
      .eq('upload_id', diagnosticUploadId)

    if (error || !files) {
      console.warn('No extracted diagnostic data found:', error?.message)
      return null
    }

    const summary: DiagnosticDataSummary = {
      hrv: null,
      dPulse: null,
      ua: null,
      vcs: null,
      brainwave: null,
      ortho: null,
      valsalva: null,
      bloodPanel: null,
      dealBreakers: [],
      findings: [],
      protocolTriggers: {
        phLow: false,
        proteinPositive: false,
        vcsLow: false,
      },
    }

    files.forEach((file) => {
      const extraction = (file.diagnostic_extracted_values as Array<{
        extracted_data: Record<string, unknown>
        extraction_confidence: number
        status: string
      }>)?.[0]

      if (!extraction || extraction.status !== 'complete') return

      const data = extraction.extracted_data

      switch (file.file_type) {
        case 'hrv':
          summary.hrv = data as unknown as DiagnosticDataSummary['hrv']
          if (data.findings && Array.isArray(data.findings)) {
            summary.findings.push(...(data.findings as string[]))
          }
          // Extract deal breakers from HRV (new BFM format)
          if (data.deal_breakers && Array.isArray(data.deal_breakers)) {
            summary.dealBreakers.push(...(data.deal_breakers as string[]))
          }
          // Extract brainwave data into separate brainwave slot
          if (data.brainwave && !summary.brainwave) {
            const bw = data.brainwave as Record<string, number>
            summary.brainwave = {
              alpha: { value: bw.alpha, status: bw.alpha < 10 ? 'low' : bw.alpha > 25 ? 'high' : 'normal' },
              beta: { value: bw.beta, status: bw.beta > 25 ? 'high' : 'normal' },
              delta: { value: bw.delta, status: bw.delta > 20 ? 'high' : 'normal' },
              gamma: { value: bw.gamma, status: bw.gamma > 30 ? 'high' : 'normal' },
              theta: { value: bw.theta, status: bw.theta > bw.alpha ? 'high' : 'normal' },
              patterns: {
                dominant_wave: (['delta', 'theta', 'alpha', 'beta', 'gamma'] as const)
                  .reduce((max, wave) => (bw[wave] ?? 0) > (bw[max] ?? 0) ? wave : max, 'alpha' as const),
                imbalances: [
                  ...(bw.alpha < 10 ? ['Low alpha'] : []),
                  ...(bw.beta > 25 ? ['High beta'] : []),
                  ...(bw.gamma > 30 ? ['High gamma'] : []),
                  ...(bw.delta > 20 ? ['High waking delta'] : []),
                  ...(bw.theta > bw.alpha ? ['Theta > Alpha (reversed field)'] : []),
                ],
              },
              findings: [],
              fsm_indicators: [],
            } as unknown as DiagnosticDataSummary['brainwave']
          }
          break

        case 'd_pulse':
          summary.dPulse = data as unknown as DiagnosticDataSummary['dPulse']
          if (data.deal_breakers && Array.isArray(data.deal_breakers)) {
            summary.dealBreakers.push(...(data.deal_breakers as string[]))
          }
          break

        case 'urinalysis':
          summary.ua = data as unknown as DiagnosticDataSummary['ua']
          if (data.findings && Array.isArray(data.findings)) {
            summary.findings.push(...(data.findings as string[]))
          }
          // Check protocol triggers
          const ph = data.ph as { value?: number; status?: string } | undefined
          if (ph?.status === 'low' || (ph?.value && ph.value < 6.5)) {
            summary.protocolTriggers.phLow = true
          }
          const protein = data.protein as { status?: string } | undefined
          if (protein?.status === 'trace' || protein?.status === 'positive') {
            summary.protocolTriggers.proteinPositive = true
          }
          // Check VCS score from UA page (BFM format puts VCS on same page)
          const vcsFromUA = data.vcs_score as { correct?: number; total?: number; passed?: boolean } | undefined
          if (vcsFromUA && !summary.vcs) {
            if (vcsFromUA.passed === false) {
              summary.protocolTriggers.vcsLow = true
            }
            // Create a synthetic VCS entry from the UA VCS data
            summary.vcs = {
              passed: vcsFromUA.passed ?? true,
              biotoxin_likely: vcsFromUA.passed === false,
              severity: vcsFromUA.passed === false ? 'moderate' : 'none',
              findings: vcsFromUA.passed === false
                ? [`VCS ${vcsFromUA.correct}/${vcsFromUA.total} - FAILED (below 24/32 threshold)`]
                : [`VCS ${vcsFromUA.correct}/${vcsFromUA.total} - passing`],
            } as unknown as DiagnosticDataSummary['vcs']
          }
          break

        case 'vcs':
          summary.vcs = data as unknown as DiagnosticDataSummary['vcs']
          if (data.findings && Array.isArray(data.findings)) {
            summary.findings.push(...(data.findings as string[]))
          }
          // Check VCS trigger
          if (data.passed === false || data.biotoxin_likely === true) {
            summary.protocolTriggers.vcsLow = true
          }
          break

        case 'brainwave':
          summary.brainwave = data as unknown as DiagnosticDataSummary['brainwave']
          if (data.findings && Array.isArray(data.findings)) {
            summary.findings.push(...(data.findings as string[]))
          }
          break

        case 'blood_panel':
          summary.bloodPanel = data as unknown as DiagnosticDataSummary['bloodPanel']
          if (data.ominous_triggers && Array.isArray(data.ominous_triggers)) {
            summary.dealBreakers.push(...(data.ominous_triggers as string[]))
          }
          break
      }
    })

    return summary
  } catch (err) {
    console.error('Error fetching extracted diagnostic data:', err)
    return null
  }
}

/**
 * Build the prompt section for extracted diagnostic data
 */
function buildExtractedDataPrompt(extractedData: DiagnosticDataSummary | null): string {
  if (!extractedData) {
    return '## Extracted Diagnostic Values\nNo diagnostic values extracted yet.'
  }

  const sections: string[] = ['## EXTRACTED DIAGNOSTIC VALUES']

  // Deal breakers first (most critical)
  if (extractedData.dealBreakers.length > 0) {
    sections.push(`### CRITICAL - Deal Breakers Identified
${extractedData.dealBreakers.map(d => `- **${d}**`).join('\n')}
These MUST be addressed first in protocol recommendations.`)
  }

  // HRV
  if (extractedData.hrv) {
    const hrv = extractedData.hrv as unknown as Record<string, unknown>
    const patterns = hrv.patterns as Record<string, boolean> | undefined
    const brainwave = hrv.brainwave as Record<string, number> | undefined
    const calm = hrv.calm_position as { pns?: number; sns?: number } | undefined
    const stressed = hrv.stressed_position as { pns?: number; sns?: number } | undefined
    const recovery = hrv.recovery_position as { pns?: number; sns?: number } | undefined

    const hrvLines = [`### HRV Analysis`]
    if (hrv.system_energy) hrvLines.push(`- **System Energy Available:** ${hrv.system_energy}/13${(hrv.system_energy as number) >= 10 ? ' (**ENERGETIC DEBT**)' : ''}`)
    if (hrv.stress_response) hrvLines.push(`- **Stress Response:** ${hrv.stress_response}/7${(hrv.stress_response as number) >= 5 ? ' (**POOR**)' : ''}`)
    if (calm) hrvLines.push(`- Calm (Blue) Position: PNS=${calm.pns}, SNS=${calm.sns}`)
    if (stressed) hrvLines.push(`- Stressed (Red) Position: PNS=${stressed.pns}, SNS=${stressed.sns}`)
    if (recovery) hrvLines.push(`- Recovery (Green) Position: PNS=${recovery.pns}, SNS=${recovery.sns}`)
    if (patterns?.switched_sympathetics) hrvLines.push(`- **DEAL BREAKER: SNS SWITCHED** - sympathetics reversed`)
    if (patterns?.pns_negative) hrvLines.push(`- **DEAL BREAKER: PNS NEGATIVE** - parasympathetic system failing`)
    if (brainwave) {
      hrvLines.push(`- Brainwave: Alpha=${brainwave.alpha}%, Beta=${brainwave.beta}%, Delta=${brainwave.delta}%, Gamma=${brainwave.gamma}%, Theta=${brainwave.theta}%`)
      if (brainwave.theta > brainwave.alpha) hrvLines.push(`- **DEAL BREAKER: Theta (${brainwave.theta}%) > Alpha (${brainwave.alpha}%) - reversed field**`)
      if (brainwave.alpha < 10) hrvLines.push(`- **DEAL BREAKER: Alpha ${brainwave.alpha}% (under 10%) - pain indicator**`)
      if (brainwave.beta > 25 || brainwave.gamma > 30) hrvLines.push(`- **Midbrain set point too high** - Beta ${brainwave.beta}%, Gamma ${brainwave.gamma}%`)
    }
    // Legacy fields
    if (hrv.hrv_score) hrvLines.push(`- HRV Score: ${hrv.hrv_score}`)
    if (hrv.rmssd) hrvLines.push(`- RMSSD: ${hrv.rmssd}`)
    hrvLines.push(`- Findings: ${(hrv.findings as string[])?.join(', ') || 'None noted'}`)
    sections.push(hrvLines.join('\n'))
  }

  // Brainwave
  if (extractedData.brainwave) {
    const bw = extractedData.brainwave
    sections.push(`### Brainwave Analysis
- Dominant Wave: ${bw.patterns?.dominant_wave ?? 'N/A'}
- Imbalances: ${bw.patterns?.imbalances?.join(', ') || 'None'}
- FSM Indicators: ${bw.fsm_indicators?.join(', ') || 'None noted'}`)
  }

  // D-Pulse
  if (extractedData.dPulse) {
    const dp = extractedData.dPulse as unknown as Record<string, unknown>
    const markers = (dp.markers as Array<{ name: string; percentage?: number; status?: string }>) || []
    const sevenDB = dp.seven_deal_breakers as Record<string, { percentage: number; status: string }> | undefined

    const dpLines = [`### D-Pulse Results`]
    if (dp.stress_index) dpLines.push(`- Stress Index: ${dp.stress_index}`)
    if (dp.vegetative_balance) dpLines.push(`- Vegetative Balance: ${dp.vegetative_balance}`)
    if (dp.brain_activity) dpLines.push(`- Brain Activity: ${dp.brain_activity}%`)
    if (dp.immunity) dpLines.push(`- Immunity: ${dp.immunity}%`)
    if (dp.physiological_resources) dpLines.push(`- Physiological Resources: ${dp.physiological_resources}${(dp.physiological_resources as number) < 150 ? ' (**BELOW NORMAL**)' : ''}`)
    dpLines.push(`- Overall: ${dp.overall_status}`)
    dpLines.push(`- **RED (Deal Breakers <40%):** ${(dp.deal_breakers as string[])?.join(', ') || 'None'}`)
    dpLines.push(`- **YELLOW (Caution 40-60%):** ${(dp.caution_areas as string[])?.join(', ') || 'None'}`)
    dpLines.push(`- GREEN (>60%): ${dp.green_count ?? 0} markers`)
    if (dp.average_energy) dpLines.push(`- Average Energy: ${dp.average_energy}%`)

    // Seven Deal Breakers detail
    if (sevenDB) {
      const dbEntries = Object.entries(sevenDB)
        .filter(([, v]) => v.status === 'red')
        .map(([k, v]) => `${k}: ${v.percentage}%`)
      if (dbEntries.length > 0) {
        dpLines.push(`- **Seven Deal Breaker organs in RED:** ${dbEntries.join(', ')}`)
      }
    }

    // List all markers for completeness
    if (markers.length > 0) {
      const lowMarkers = markers
        .filter(m => (m.percentage ?? 0) < 60)
        .sort((a, b) => (a.percentage ?? 0) - (b.percentage ?? 0))
        .map(m => `${m.name}: ${m.percentage}%`)
      if (lowMarkers.length > 0) {
        dpLines.push(`- Low-energy organs: ${lowMarkers.join(', ')}`)
      }
    }
    sections.push(dpLines.join('\n'))
  }

  // Urinalysis
  if (extractedData.ua) {
    const ua = extractedData.ua as unknown as Record<string, unknown>
    const phObj = ua.ph as { value?: number; status?: string } | undefined
    const proteinObj = ua.protein as { value?: string; status?: string } | undefined
    const sgObj = ua.specific_gravity as { value?: number; status?: string } | undefined
    const vcsObj = ua.vcs_score as { correct?: number; total?: number; passed?: boolean } | undefined
    const heavyMetals = ua.heavy_metals as string[] | undefined

    const uaLines = [`### Urinalysis (UA)`]
    const phVal = phObj?.value
    const phStat = phObj?.status
    uaLines.push(`- **pH:** ${phVal ?? 'N/A'}${phStat === 'low' ? ` (**LOW - under 6.5, DEAL BREAKER**) → Recommend: Cell Synergy or Tri-Salts` : ` (${phStat || ''})`}`)
    uaLines.push(`- **Protein:** ${proteinObj?.value ?? 'N/A'}${proteinObj?.status === 'trace' || proteinObj?.status === 'positive' ? ' (**POSITIVE - DEAL BREAKER**) → Recommend: X-39 patches' : ''}`)
    uaLines.push(`- Specific Gravity: ${sgObj?.value ?? 'N/A'}${sgObj?.status === 'high' ? ' (HIGH - possible dehydration)' : ''}`)

    if (vcsObj) {
      uaLines.push(`- **VCS Score:** ${vcsObj.correct}/${vcsObj.total}${vcsObj.passed === false ? ' (**FAILED - DEAL BREAKER**) → Recommend: Pectasol-C, Biotoxin, Leptin Resist' : ' (passing)'}`)
    }

    if (heavyMetals && heavyMetals.length > 0) {
      uaLines.push(`- **Heavy Metals Detected:** ${heavyMetals.join(', ')}`)
    }

    sections.push(uaLines.join('\n'))
  }

  // VCS
  if (extractedData.vcs) {
    const vcs = extractedData.vcs
    sections.push(`### VCS (Visual Contrast Sensitivity)
- Result: ${vcs.passed ? 'PASSED' : '**FAILED**'}${!vcs.passed ? ' → **Recommend: Pectasol-C or Leptin settings**' : ''}
- Biotoxin Likely: ${vcs.biotoxin_likely ? 'Yes' : 'No'}
- Severity: ${vcs.severity || 'N/A'}
- Failed Columns: ${vcs.failed_columns?.join(', ') || 'None'}`)
  }

  // Blood Panel
  if (extractedData.bloodPanel) {
    const bp = extractedData.bloodPanel
    sections.push(`### Blood Panel
- Total Markers: ${bp.total_markers ?? 0}
- Out of Range: ${bp.out_of_range_count ?? 0}
- Ominous Triggers: ${bp.ominous_triggers?.join(', ') || 'None'}`)
  }

  return sections.join('\n\n')
}

/**
 * Build the prompt section for protocol engine results (deterministic output).
 * When present, these are MANDATORY recommendations the AI must include.
 */
function buildProtocolEngineSection(engineResult: ProtocolEngineResult | null): string {
  if (!engineResult) {
    return ''
  }

  const sections: string[] = []

  sections.push(`## PROTOCOL ENGINE OUTPUT (MANDATORY - from Master Protocol Key rules)
The following protocols and supplements were determined by the deterministic rules engine.
These are GROUND TRUTH — you MUST include all of them in your output.`)

  if (engineResult.deal_breakers.length > 0) {
    sections.push(`### Deal Breakers Found (address FIRST)
${engineResult.deal_breakers.map(d => `- **${d}**`).join('\n')}`)
  }

  if (engineResult.protocols.length > 0) {
    const p1 = engineResult.protocols.filter(p => p.priority === 1)
    const p2 = engineResult.protocols.filter(p => p.priority === 2)
    const p3 = engineResult.protocols.filter(p => p.priority >= 3)

    if (p1.length > 0) {
      sections.push(`### Priority 1 — Deal Breaker Protocols (MUST include)
${p1.map(p => `- **${p.name}** — ${p.trigger}${p.notes ? ` (${p.notes})` : ''}`).join('\n')}`)
    }
    if (p2.length > 0) {
      sections.push(`### Priority 2 — High Priority Protocols
${p2.map(p => `- **${p.name}** — ${p.trigger}${p.notes ? ` (${p.notes})` : ''}`).join('\n')}`)
    }
    if (p3.length > 0) {
      sections.push(`### Priority 3 — Standard Protocols
${p3.map(p => `- **${p.name}** — ${p.trigger}${p.notes ? ` (${p.notes})` : ''}`).join('\n')}`)
    }
  }

  if (engineResult.supplements.length > 0) {
    sections.push(`### Required Supplements
${engineResult.supplements.map(s =>
  `- **${s.name}** — ${s.trigger}${s.dosage ? ` | Dose: ${s.dosage}` : ''}${s.timing ? ` | Timing: ${s.timing}` : ''}${s.notes ? ` | ${s.notes}` : ''}`
).join('\n')}`)
  }

  if (engineResult.cross_correlations.length > 0) {
    sections.push(`### Cross-Diagnostic Correlations
${engineResult.cross_correlations.map(c => `- ${c}`).join('\n')}`)
  }

  return sections.join('\n\n')
}

async function callAIForAnalysis(
  patient: PatientContext,
  files: DiagnosticFile[],
  ragChunks: RagChunk[],
  fsmFrequencies: Array<Record<string, unknown>>,
  hasLabs: boolean,
  userRole: 'practitioner' | 'member',
  extractedData: DiagnosticDataSummary | null,
  approvedFrequencyNames: string[],
  diagnosticUploadId: string,
  engineResult: ProtocolEngineResult | null = null
): Promise<Omit<GeneratedAnalysis, 'ragContext' | 'extractedData'>> {
  const client = getAnthropicClient()

  // Build context from RAG results, PRIORITIZING Sunday docs
  const sundayChunks = ragChunks.filter(c => c.seminar_day === 'sunday' || c.search_phase === 'sunday_primary')
  const otherChunks = ragChunks.filter(c => c.seminar_day !== 'sunday' && c.search_phase !== 'sunday_primary')

  const sundayContext = sundayChunks.length > 0
    ? `### PRIMARY SOURCE - BFM Sunday Transcripts (TACTICAL GUIDANCE)\n${sundayChunks.map(chunk => `[From: ${chunk.title || chunk.filename}]\n${chunk.content}`).join('\n\n---\n\n')}`
    : ''

  const supplementaryContext = otherChunks.length > 0
    ? `### SUPPLEMENTARY SOURCES\n${otherChunks.map(chunk => `[From: ${chunk.title || chunk.filename}]\n${chunk.content}`).join('\n\n---\n\n')}`
    : ''

  const ragContext = [sundayContext, supplementaryContext].filter(Boolean).join('\n\n')

  // Build extracted diagnostic data section
  const extractedDataSection = buildExtractedDataPrompt(extractedData)

  // Build approved frequency list
  const frequencyList = approvedFrequencyNames.length > 0
    ? `## APPROVED FREQUENCY NAMES (use ONLY these - no Hz values)\n${approvedFrequencyNames.map(name => `- ${name}`).join('\n')}`
    : '## Note: No approved frequency names found in system. Use frequency names from RAG context only.'

  // Build FSM reference (for context, but don't use Hz values in output)
  const fsmReference = fsmFrequencies.length > 0
    ? fsmFrequencies.map(f => `- ${f.name} (for ${f.condition})`).join('\n')
    : ''

  // Build protocol engine section (deterministic rules output)
  const engineSection = buildProtocolEngineSection(engineResult)

  // Build user message with all context
  const userMessage = `
## Patient Information
- Name: ${patient.firstName} ${patient.lastName}
- Gender: ${patient.gender}
- Date of Birth: ${patient.dateOfBirth}
${patient.medicalHistory ? `- Medical History: ${patient.medicalHistory}` : ''}
${patient.currentMedications?.length ? `- Current Medications: ${patient.currentMedications.join(', ')}` : ''}
${patient.allergies?.length ? `- Allergies: ${patient.allergies.join(', ')}` : ''}

## Diagnostic Files Uploaded
${files.map(f => `- ${f.filename} (${f.fileType})`).join('\n')}

${extractedDataSection}

${engineSection}

## Lab Data Available
${hasLabs ? 'Yes - blood panel data is available for detailed supplementation' : 'No blood panel - base supplementation on HRV, D-Pulse, UA, and VCS findings'}

${frequencyList}

## Reference Knowledge Base (RAG Context)
${ragContext || 'No relevant documents found in knowledge base.'}

${fsmReference ? `## FSM Frequency Reference (context only)\n${fsmReference}` : ''}

---

${engineResult
  ? `YOUR TASK: The Protocol Engine has already determined the correct protocols and supplements above.
Your job is to:
1. Write a clear, Dr. Rob-style summary explaining WHY these protocols were selected based on the diagnostic data
2. Organize the engine's protocols into your JSON output — use the engine protocol names as frequency names
3. Include ALL supplements from the engine output in your supplementation array
4. Add a reasoning_chain explaining the diagnostic-to-protocol logic
5. You MAY add additional protocols ONLY if the RAG context clearly supports them AND they are on the approved list
6. Do NOT remove or contradict any protocol the engine selected — those are ground truth from the Master Protocol Key`
  : `Based on the above patient information, extracted diagnostic values, and BFM Sunday documentation, please provide your analysis and recommendations.

SUPPLEMENTATION TRIGGERS (always recommend when these findings are present):
- pH low on UA → Cell Synergy or Trisalts
- Protein positive on UA → X39 patches
- VCS failed → Pectasol-C or Leptin protocols
- D-Pulse RED markers → specific supplements from Sunday sessions
- HRV autonomic dysfunction → relevant support supplements
- Blood panel abnormalities → targeted supplementation (when labs available)

Base ALL supplement recommendations on Dr. Rob's Sunday session content.`}

REMEMBER (CRITICAL):
1. Use ONLY frequency NAMES from the approved list - NO Hz values like "40/116" EVER
2. Valid examples: "Liver Inflame", "PNS Support", "Thyroid 1" - NOT "40/116" or "40 Hz"
3. Cite which document section supports each recommendation
4. Follow the diagnostic analysis order: HRV → Brainwave → D-Pulse → UA → VCS → Labs
5. If unsure about a frequency name, DO NOT include it - only use exact matches from approved list
`

  const systemPrompt = userRole === 'practitioner'
    ? DR_ROB_PRACTITIONER_PROMPT
    : DR_ROB_MEMBER_PROMPT

  // Use streaming to avoid Anthropic SDK timeout on long-running analysis calls
  const stream = client.messages.stream({
    model: getAnalysisModel(),
    max_tokens: 25000,
    temperature: 0.7,
    system: systemPrompt + JSON_SYSTEM_SUFFIX,
    messages: [
      { role: 'user', content: userMessage },
    ],
  })

  const response = await stream.finalMessage()

  const textBlock = response.content.find((b) => b.type === 'text')
  const content = textBlock && 'text' in textBlock ? textBlock.text : null
  if (!content) {
    throw new Error('No response from AI')
  }

  if (response.stop_reason === 'max_tokens') {
    console.error('[Analysis] Response truncated at max_tokens limit — JSON will be incomplete')
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = extractJSON<any>(content)

    // Handle member response format (insights instead of protocols)
    if (userRole === 'member') {
      return {
        summary: parsed.summary + '\n\n' + (parsed.disclaimer || ''),
        protocols: [], // Members don't get protocols
        supplementation: [], // Members don't get supplementation
        reasoningChain: [], // Members don't get reasoning chain
      }
    }

    // CRITICAL: Validate ALL frequencies against approved list
    // This prevents hallucinated names and Hz values from reaching practitioners
    const validatedProtocols: Array<{
      title: string
      description: string
      category: string
      frequencies: RecommendedFrequency[]
      priority: number
      validationReport?: BatchValidationResult
    }> = []

    for (const [idx, p] of (parsed.protocols || []).entries()) {
      const rawFrequencies = ((p.frequencies as Array<{ name: string; rationale?: string }>) || []).map(f => ({
        name: f.name || '',
        rationale: f.rationale,
      }))

      // Validate and filter frequencies
      const { filteredProtocol, validationReport } = await filterAndValidateProtocol({
        title: p.title as string,
        frequencies: rawFrequencies,
      })

      // Log validation results for admin telemetry
      // This captures all validation decisions (passed and failed) for RAG improvement
      if (validationReport.validCount > 0 || validationReport.rejectedCount > 0) {
        // Build rationale map from AI output
        const aiRationales = new Map<string, string>()
        for (const f of rawFrequencies) {
          if (f.rationale) {
            aiRationales.set(f.name, f.rationale)
          }
        }

        // Log to telemetry (non-blocking)
        logValidationTelemetry(
          { diagnosticUploadId },
          validationReport,
          aiRationales,
          sundayChunks.length > 0 ? sundayChunks[0].content.slice(0, 500) : undefined
        ).catch(err => console.error('[Telemetry] Failed to log:', err))
      }

      // Console warning for immediate visibility
      if (validationReport.rejectedCount > 0) {
        console.warn(
          `[Frequency Validation] Protocol "${p.title}": ${validationReport.rejectedCount} frequencies rejected:`,
          validationReport.rejectedFrequencies.map(f => ({
            name: f.frequencyName,
            reason: f.rejectionReason,
            error: f.error,
          }))
        )
      }

      // Only include protocols that have at least one valid frequency
      if (filteredProtocol.frequencies.length > 0) {
        validatedProtocols.push({
          title: p.title as string,
          description: p.description as string,
          category: (p.category as string) || 'general',
          frequencies: filteredProtocol.frequencies.map(f => ({
            id: crypto.randomUUID(),
            name: f.name, // Now guaranteed to be from approved list
            rationale: f.rationale,
          })),
          priority: (p.priority as number) || idx + 1,
          validationReport,
        })
      } else {
        console.warn(`[Frequency Validation] Protocol "${p.title}" dropped - no valid frequencies`)
      }
    }

    // CRITICAL: Deduplicate frequencies across ALL protocols
    // Each frequency name should appear only ONCE in the entire analysis
    // When same frequency appears in multiple protocols, merge rationales
    const {
      deduplicatedProtocols,
      deduplicationLog,
      totalDeduplicated,
    } = deduplicateFrequenciesAcrossProtocols(validatedProtocols)

    // Log deduplication for debugging/telemetry
    if (totalDeduplicated > 0) {
      console.log(
        `[Frequency Deduplication] Removed ${totalDeduplicated} duplicate frequencies:`,
        deduplicationLog.map((d) => ({
          frequency: d.frequencyName,
          keptIn: d.keptInProtocol,
          removedFrom: d.removedFromProtocols,
          rationalesMerged: d.mergedRationales.length > 1,
        }))
      )
    }

    // Filter out any protocols that now have zero frequencies after deduplication
    const protocols = deduplicatedProtocols.filter((p) => p.frequencies.length > 0)

    // Warn if any protocols were emptied by deduplication
    const emptiedProtocols = deduplicatedProtocols.filter((p) => p.frequencies.length === 0)
    if (emptiedProtocols.length > 0) {
      console.warn(
        `[Frequency Deduplication] ${emptiedProtocols.length} protocol(s) now empty after deduplication:`,
        emptiedProtocols.map((p) => p.title)
      )
    }

    // Post-processing: ensure layer fields exist on supplementation (fallback for older models)
    const rawSupplementation = (parsed.supplementation || []) as Supplementation[]
    const supplementation: Supplementation[] = rawSupplementation.map(s => {
      if (s.layer && typeof s.layer === 'number') return s
      // Derive layer from supplement name heuristics
      const name = (s.name || '').toLowerCase()
      const day1Names = ['cell synergy', 'tri-salts', 'trisalts', 'pectasol', 'x-39', 'x39', 'serculate', 'coq10', 'vagus nerve', 'deuterium drops']
      const layer2Names = ['vitamin d', 'ip6 gold', 'ip6gold', 'homocysteine', 'adipothin', 'livergy', 'pancreos']
      const layer3Names = ['epi pineal', 'hypothala', 'rejuvenation', 'fatty 15', 'deuterium homeopathic']
      if (day1Names.some(n => name.includes(n))) return { ...s, layer: 1 }
      if (layer2Names.some(n => name.includes(n))) return { ...s, layer: 2 }
      if (layer3Names.some(n => name.includes(n))) return { ...s, layer: 3 }
      return { ...s, layer: 0 }
    })

    return {
      summary: parsed.summary as string,
      protocols,
      supplementation,
      reasoningChain: (parsed.reasoning_chain as string[]) || [],
    }
  } catch (parseError) {
    console.error('[Analysis] Failed to parse AI response:', parseError)
    console.error('[Analysis] Raw content (first 500 chars):', content?.slice(0, 500))
    console.error('[Analysis] Raw content (last 200 chars):', content?.slice(-200))
    throw new Error('Failed to parse analysis response')
  }
}

// ============================================
// SAVE ANALYSIS TO DATABASE
// ============================================

export async function saveAnalysisToDatabase(
  diagnosticUploadId: string,
  patientId: string,
  practitionerId: string,
  analysis: GeneratedAnalysis
): Promise<{ analysisId: string; recommendationIds: string[] }> {
  const supabase = await createClient()

  // 1. Create diagnostic_analyses record
  const { data: analysisRecord, error: analysisError } = await supabase
    .from('diagnostic_analyses')
    .insert({
      diagnostic_upload_id: diagnosticUploadId,
      patient_id: patientId,
      practitioner_id: practitionerId,
      summary: analysis.summary,
      raw_analysis: {
        protocols: analysis.protocols,
        supplementation: analysis.supplementation,
      },
      supplementation: analysis.supplementation || [], // Store at analysis level
      status: 'complete',
      is_archived: false, // New analyses are not archived
      rag_context: {
        chunks: analysis.ragContext.map(c => ({
          chunk_id: c.chunk_id,
          document_id: c.document_id,
          title: c.title,
          filename: c.filename,
          similarity: c.similarity,
          seminar_day: c.seminar_day,
          search_phase: c.search_phase,
        })),
      },
    })
    .select('id')
    .single()

  if (analysisError || !analysisRecord) {
    throw new Error(`Failed to save analysis: ${analysisError?.message}`)
  }

  const analysisId = analysisRecord.id

  // 2. Create protocol_recommendations records
  const recommendationIds: string[] = []

  for (const protocol of analysis.protocols) {
    const { data: recRecord, error: recError } = await supabase
      .from('protocol_recommendations')
      .insert({
        diagnostic_analysis_id: analysisId,
        patient_id: patientId,
        title: protocol.title,
        description: protocol.description,
        category: protocol.category,
        recommended_frequencies: protocol.frequencies,
        supplementation: [], // Supplementation now stored at analysis level
        priority: protocol.priority,
        status: 'recommended',
      })
      .select('id')
      .single()

    if (recError) {
      console.error('Failed to save recommendation:', recError)
      continue
    }

    if (recRecord) {
      recommendationIds.push(recRecord.id)
    }
  }

  return { analysisId, recommendationIds }
}
