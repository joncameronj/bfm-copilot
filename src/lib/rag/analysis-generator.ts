// Diagnostic Analysis Generator with RAG
// Generates protocol recommendations in "Dr. Rob's voice"

import { createClient } from '@/lib/supabase/server'
import { getOpenAIClient } from '@/lib/openai'
import { generateEmbedding } from './embeddings'
import type { RecommendedFrequency, Supplementation } from '@/types/diagnostic-analysis'

// ============================================
// DR. ROB VOICE SYSTEM PROMPTS
// ============================================

const DR_ROB_PRACTITIONER_PROMPT = `You are speaking as Dr. Rob, an expert in Frequency Specific Microcurrent (FSM) and integrative medicine. You are providing analysis to a practitioner.

When explaining findings:
- Use clear, professional language with medical accuracy
- Include helpful analogies to explain complex concepts
- Connect symptoms to underlying causes based on the diagnostic data
- Reference FSM protocols with specific frequencies when relevant
- Be confident and direct in your recommendations

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
          "name": "Frequency name",
          "frequencyA": 40,
          "frequencyB": 116,
          "rationale": "Why this frequency is recommended"
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
  ]
}

Guidelines for protocols:
- Recommend 4-6 protocols typically, based on the diagnostic findings
- Each protocol should have 1-3 relevant FSM frequencies
- Prioritize protocols (1 = most important)
- Only include supplementation if lab data is available
- Base all recommendations on the RAG context provided`

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

  // 3. Check if patient has labs
  const { data: labResults } = await supabase
    .from('lab_results')
    .select('id, test_date, ominous_count')
    .eq('patient_id', patientId)
    .order('test_date', { ascending: false })
    .limit(1)

  const hasLabs = Boolean(labResults && labResults.length > 0)

  // 4. Build query for RAG search
  const queryText = buildSearchQuery(patientContext, diagnosticFiles)

  // 5. Generate embedding and search documents
  const queryEmbedding = await generateEmbedding(queryText)

  // Use the smart search function with role scoping
  const { data: ragResults, error: ragError } = await supabase.rpc(
    'smart_search_documents_v2',
    {
      p_query_embedding: queryEmbedding,
      p_user_id: practitionerId,
      p_user_role: userRole,
      p_match_threshold: 0.5,
      p_match_count: 15,
    }
  )

  if (ragError) {
    console.error('RAG search error:', ragError)
    // Continue without RAG context if search fails
  }

  const ragChunks: RagChunk[] = (ragResults || []).map((r: Record<string, unknown>) => ({
    chunk_id: r.chunk_id as string,
    document_id: r.document_id as string,
    content: r.content as string,
    title: r.title as string | null,
    filename: r.filename as string,
    similarity: r.similarity as number,
  }))

  // 6. Get FSM frequencies for reference
  const { data: fsmFrequencies } = await supabase
    .from('fsm_frequencies')
    .select('id, name, frequency_a, frequency_b, category, condition, description')
    .eq('is_active', true)

  // 7. Generate analysis with AI
  const analysis = await callAIForAnalysis(
    patientContext,
    diagnosticFiles,
    ragChunks,
    fsmFrequencies || [],
    hasLabs,
    userRole
  )

  return {
    ...analysis,
    ragContext: ragChunks,
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function buildSearchQuery(patient: PatientContext, files: DiagnosticFile[]): string {
  const parts: string[] = []

  // Add chief complaints
  if (patient.chiefComplaints) {
    parts.push(`Patient presents with: ${patient.chiefComplaints}`)
  }

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

async function callAIForAnalysis(
  patient: PatientContext,
  files: DiagnosticFile[],
  ragChunks: RagChunk[],
  fsmFrequencies: Array<Record<string, unknown>>,
  hasLabs: boolean,
  userRole: 'practitioner' | 'member'
): Promise<Omit<GeneratedAnalysis, 'ragContext'>> {
  const openai = getOpenAIClient()

  // Build context from RAG results
  const ragContext = ragChunks
    .map(chunk => `[From: ${chunk.title || chunk.filename}]\n${chunk.content}`)
    .join('\n\n---\n\n')

  // Build FSM reference
  const fsmReference = fsmFrequencies
    .map(f => `- ${f.name}: ${f.frequency_a}/${f.frequency_b || 'N/A'} Hz - ${f.condition}`)
    .join('\n')

  // Build user message with all context
  const userMessage = `
## Patient Information
- Name: ${patient.firstName} ${patient.lastName}
- Gender: ${patient.gender}
- Date of Birth: ${patient.dateOfBirth}
${patient.chiefComplaints ? `- Chief Complaints: ${patient.chiefComplaints}` : ''}
${patient.medicalHistory ? `- Medical History: ${patient.medicalHistory}` : ''}
${patient.currentMedications?.length ? `- Current Medications: ${patient.currentMedications.join(', ')}` : ''}
${patient.allergies?.length ? `- Allergies: ${patient.allergies.join(', ')}` : ''}

## Diagnostic Files Uploaded
${files.map(f => `- ${f.filename} (${f.fileType})`).join('\n')}

## Lab Data Available
${hasLabs ? 'Yes - include supplementation recommendations' : 'No - do not include supplementation recommendations'}

## Reference Knowledge Base (RAG Context)
${ragContext || 'No relevant documents found in knowledge base.'}

## Available FSM Frequencies
${fsmReference || 'Use standard FSM frequency protocols.'}

---

Based on the above patient information, diagnostic files, and reference materials, please provide your analysis and recommendations.
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
      }
    }

    // Map frequencies to include IDs where possible
    const protocols = (parsed.protocols || []).map((p: Record<string, unknown>, idx: number) => ({
      title: p.title as string,
      description: p.description as string,
      category: p.category as string || 'general',
      frequencies: ((p.frequencies as RecommendedFrequency[]) || []).map(f => ({
        id: crypto.randomUUID(), // Generate ID for tracking
        name: f.name,
        frequencyA: f.frequencyA,
        frequencyB: f.frequencyB,
        rationale: f.rationale,
      })),
      priority: (p.priority as number) || idx + 1,
    }))

    return {
      summary: parsed.summary as string,
      protocols,
      supplementation: hasLabs ? (parsed.supplementation || []) : [],
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
      status: 'complete',
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
        supplementation: analysis.supplementation, // Attach to first protocol if any
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
