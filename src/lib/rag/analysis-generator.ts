// Diagnostic Analysis Generator with RAG
// Generates protocol recommendations in "Dr. Rob's voice"
// Uses Sunday-first RAG search and frequency name validation

import { createClient } from '@/lib/supabase/server'
import { getOpenAIClient } from '@/lib/openai'
import { generateEmbedding } from './embeddings'
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
      "priority": 1
    }
  ],
  "supplementation": [
    {
      "name": "Supplement name",
      "dosage": "Recommended dosage",
      "timing": "When to take",
      "rationale": "Why this is recommended based on the data"
    }
  ],
  "reasoning_chain": [
    "Step 1: What the HRV showed...",
    "Step 2: What the D-Pulse deal breakers indicated...",
    "Step 3: How this led to protocol selection..."
  ]
}

Guidelines for protocols:
- Recommend 4-6 protocols typically, based on the diagnostic findings
- Each protocol should have 1-3 relevant FSM frequencies (NAMES ONLY from approved list)
- Prioritize protocols based on deal breakers and critical findings (1 = most important)
- Include supplementation based on ALL diagnostic findings (HRV, D-Pulse, UA, VCS)
- When labs are available, add additional supplement recommendations based on blood markers
- Base all recommendations on the BFM Sunday documentation (primary source) and RAG context
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

  // 5. Determine if we have lab data for supplementation recommendations
  // Include labs if either:
  // - Patient has existing lab_results records, OR
  // - This diagnostic upload includes extracted blood panel data
  const hasExtractedBloodPanel = extractedData?.bloodPanel !== null
  const hasLabs = hasExistingLabResults || hasExtractedBloodPanel

  // 7. Build query for RAG search
  const queryText = buildSearchQuery(patientContext, diagnosticFiles, extractedData)

  // 8. Perform RAG search via Python agent (single source of truth)
  // This ensures consistent search behavior across chat and diagnostic analysis
  const pythonAgentUrl = process.env.PYTHON_AGENT_URL || 'http://localhost:8000'

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
      }),
    })

    if (!ragResponse.ok) {
      throw new Error(`RAG search failed: ${ragResponse.status} ${ragResponse.statusText}`)
    }

    const ragData = await ragResponse.json()

    // Convert Python agent response to RagChunk format
    ragChunks = (ragData.results || []).map((r: Record<string, unknown>) => ({
      chunk_id: '', // Not provided by Python agent
      document_id: '', // Not provided by Python agent
      content: r.content as string,
      title: r.title as string | null,
      filename: r.filename as string,
      similarity: r.similarity as number,
      care_category: undefined,
      document_category: r.document_category as string | undefined,
      seminar_day: undefined,
      search_phase: r.match_type as string | undefined, // Use match_type as search_phase
      priority_rank: undefined,
    }))

    console.log(`[RAG] Python agent returned ${ragChunks.length} results for diagnostic analysis`)
  } catch (ragError) {
    console.error('Python agent RAG search error:', ragError)

    // Fallback to Supabase RPC if Python agent fails
    console.warn('Falling back to Supabase RPC for RAG search')
    const queryEmbedding = await generateEmbedding(queryText)

    const { data: fallbackResults } = await supabase.rpc(
      'smart_search_documents_v2',
      {
        p_query_embedding: queryEmbedding,
        p_user_id: practitionerId,
        p_user_role: userRole,
        p_match_threshold: 0.40,
        p_match_count: 15,
      }
    )

    if (fallbackResults) {
      ragChunks = (fallbackResults || []).map((r: Record<string, unknown>) => ({
        chunk_id: r.chunk_id as string,
        document_id: r.document_id as string,
        content: r.content as string,
        title: r.title as string | null,
        filename: r.filename as string,
        similarity: r.similarity as number,
        care_category: r.care_category as string | undefined,
        document_category: r.document_category as string | undefined,
        seminar_day: r.seminar_day as string | undefined,
        search_phase: undefined,
        priority_rank: undefined,
      }))
      console.log(`[RAG] Fallback returned ${ragChunks.length} results`)
    }
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

  // 11. Generate analysis with AI
  const analysis = await callAIForAnalysis(
    patientContext,
    diagnosticFiles,
    ragChunks,
    fsmFrequencies || [],
    hasLabs,
    userRole,
    extractedData,
    approvedFrequencyNames,
    diagnosticUploadId
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
          if (ph?.status === 'low' || (ph?.value && ph.value < 6.0)) {
            summary.protocolTriggers.phLow = true
          }
          const protein = data.protein as { status?: string } | undefined
          if (protein?.status === 'trace' || protein?.status === 'positive') {
            summary.protocolTriggers.proteinPositive = true
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
    const hrv = extractedData.hrv
    sections.push(`### HRV Analysis
- HRV Score: ${hrv.hrv_score ?? 'N/A'}
- RMSSD: ${hrv.rmssd ?? 'N/A'}
- LF/HF Ratio: ${hrv.lf_hf_ratio ?? 'N/A'}
- Pattern: ${hrv.patterns?.balanced ? 'Balanced' : hrv.patterns?.sympathetic_dominance ? 'Sympathetic Dominant (stress)' : hrv.patterns?.parasympathetic_dominance ? 'Parasympathetic Dominant' : 'Unknown'}
- Findings: ${hrv.findings?.join(', ') || 'None noted'}`)
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
    const dp = extractedData.dPulse
    sections.push(`### D-Pulse Results
- Overall: ${dp.overall_status}
- RED (Deal Breakers): ${dp.deal_breakers?.join(', ') || 'None'}
- YELLOW (Caution): ${dp.caution_areas?.join(', ') || 'None'}
- GREEN: ${dp.green_count ?? 0} markers`)
  }

  // Urinalysis
  if (extractedData.ua) {
    const ua = extractedData.ua
    const phValue = typeof ua.ph === 'object' && ua.ph ? ua.ph.value : ua.ph
    const phStatus = typeof ua.ph === 'object' && ua.ph ? ua.ph.status : ''
    const proteinValue = typeof ua.protein === 'object' && ua.protein ? ua.protein.value : ua.protein
    const proteinStatus = typeof ua.protein === 'object' && ua.protein ? ua.protein.status : ''

    sections.push(`### Urinalysis (UA)
- pH: ${phValue ?? 'N/A'} (${phStatus || ''})${phStatus === 'low' ? ' → **Recommend: Cell Synergy or Trisalts**' : ''}
- Protein: ${proteinValue ?? 'N/A'}${proteinStatus === 'trace' || proteinStatus === 'positive' ? ' → **Recommend: X39 patches**' : ''}
- Specific Gravity: ${typeof ua.specific_gravity === 'object' && ua.specific_gravity ? ua.specific_gravity.value : 'N/A'}`)
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

async function callAIForAnalysis(
  patient: PatientContext,
  files: DiagnosticFile[],
  ragChunks: RagChunk[],
  fsmFrequencies: Array<Record<string, unknown>>,
  hasLabs: boolean,
  userRole: 'practitioner' | 'member',
  extractedData: DiagnosticDataSummary | null,
  approvedFrequencyNames: string[],
  diagnosticUploadId: string
): Promise<Omit<GeneratedAnalysis, 'ragContext' | 'extractedData'>> {
  const openai = getOpenAIClient()

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

## Lab Data Available
${hasLabs ? 'Yes - blood panel data is available for detailed supplementation' : 'No blood panel - base supplementation on HRV, D-Pulse, UA, and VCS findings'}
Include supplementation recommendations based on ALL diagnostic findings.

SUPPLEMENTATION TRIGGERS (always recommend when these findings are present):
- pH low on UA → Cell Synergy or Trisalts
- Protein positive on UA → X39 patches
- VCS failed → Pectasol-C or Leptin protocols
- D-Pulse RED markers → specific supplements from Sunday sessions
- HRV autonomic dysfunction → relevant support supplements
- Blood panel abnormalities → targeted supplementation (when labs available)

Base ALL supplement recommendations on Dr. Rob's Sunday session content.

${frequencyList}

## Reference Knowledge Base (RAG Context)
${ragContext || 'No relevant documents found in knowledge base.'}

${fsmReference ? `## FSM Frequency Reference (context only)\n${fsmReference}` : ''}

---

Based on the above patient information, extracted diagnostic values, and BFM Sunday documentation, please provide your analysis and recommendations.

REMEMBER (CRITICAL):
1. Use ONLY frequency NAMES from the approved list - NO Hz values like "40/116" EVER
2. Valid examples: "Liver Inflame", "PNS Support", "Thyroid 1" - NOT "40/116" or "40 Hz"
3. Cite which document section supports each recommendation
4. Prioritize protocols based on deal breakers and "seven deal breakers"
5. Follow the diagnostic analysis order: HRV → Brainwave → D-Pulse → UA → VCS → Labs
6. If unsure about a frequency name, DO NOT include it - only use exact matches from approved list
`

  const systemPrompt = userRole === 'practitioner'
    ? DR_ROB_PRACTITIONER_PROMPT
    : DR_ROB_MEMBER_PROMPT

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 4000,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No response from AI')
  }

  try {
    const parsed = JSON.parse(content)

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

    return {
      summary: parsed.summary as string,
      protocols,
      supplementation: parsed.supplementation || [],
      reasoningChain: (parsed.reasoning_chain as string[]) || [],
    }
  } catch (parseError) {
    console.error('Failed to parse AI response:', parseError)
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
          similarity: c.similarity,
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
