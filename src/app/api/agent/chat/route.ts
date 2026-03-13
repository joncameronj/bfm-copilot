import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getPythonAgentUrl } from '@/lib/agent/url'
import { extractDiagnosticValues } from '@/lib/vision'
import { parseLabPdf } from '@/lib/labs/pdf-parser'
import type { DiagnosticType } from '@/types/shared'

export const dynamic = 'force-dynamic'
const CHAT_UPLOAD_BUCKET = 'diagnostics'
const STORAGE_FILE_ID_PREFIX = 'storage:'

const CHAT_HISTORY_MESSAGE_LIMIT = Number.parseInt(
  process.env.CHAT_HISTORY_MESSAGE_LIMIT || '400',
  10
)
const CHAT_HISTORY_CHAR_BUDGET = Number.parseInt(
  process.env.CHAT_HISTORY_CHAR_BUDGET || '1800000',
  10
)

interface PatientContext {
  first_name?: string
  last_name?: string
  age?: number
  gender?: string
  chief_complaints?: string
  medical_history?: string
}

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface ChatAttachment {
  id: string
  filename?: string
  mimeType?: string
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength)}...`
}

function parseStoragePath(fileId: string): string | null {
  if (fileId.startsWith(STORAGE_FILE_ID_PREFIX)) {
    return fileId.slice(STORAGE_FILE_ID_PREFIX.length)
  }

  // Backward compatibility: older chat uploads generated synthetic local IDs.
  if (fileId.startsWith('local_')) {
    return null
  }

  // Fallback for any raw storage path IDs.
  return fileId.includes('/') ? fileId : null
}

function getFilenameFromPath(path: string): string {
  const pathParts = path.split('/')
  const lastPart = pathParts[pathParts.length - 1] || path

  // Stored pattern: "{timestamp}-{uuid}-{sanitizedOriginalName}".
  const parts = lastPart.split('-')
  if (parts.length >= 3) {
    return parts.slice(2).join('-')
  }

  return lastPart
}

function inferMimeType(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.doc')) return 'application/msword'
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  if (lower.endsWith('.txt')) return 'text/plain'
  return 'application/octet-stream'
}

function inferDiagnosticType(filename: string): DiagnosticType {
  const normalized = filename.toLowerCase()

  if (
    normalized.includes('hrv') ||
    normalized.includes('heart rate variability')
  ) {
    return 'hrv'
  }
  if (
    normalized.includes('depulse') ||
    normalized.includes('d-pulse') ||
    normalized.includes('d_pulse')
  ) {
    return 'd_pulse'
  }
  if (
    normalized.includes('urinalysis') ||
    normalized.includes('urine') ||
    /\bua\b/.test(normalized)
  ) {
    return 'urinalysis'
  }
  if (normalized.includes('vcs')) {
    return 'vcs'
  }
  if (normalized.includes('brain') || normalized.includes('eeg')) {
    return 'brainwave'
  }
  if (
    normalized.includes('lab') ||
    normalized.includes('blood') ||
    normalized.includes('cbc') ||
    normalized.includes('cmp') ||
    normalized.includes('panel')
  ) {
    return 'blood_panel'
  }

  return 'other'
}

function isLikelyLabReport(filename: string): boolean {
  const normalized = filename.toLowerCase()
  return (
    normalized.includes('lab') ||
    normalized.includes('blood') ||
    normalized.includes('cbc') ||
    normalized.includes('cmp') ||
    normalized.includes('panel') ||
    normalized.includes('chem') ||
    normalized.includes('metabolic') ||
    normalized.includes('lipid') ||
    normalized.includes('thyroid')
  )
}

async function summarizePdfAttachment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePath: string,
  filename: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CHAT_UPLOAD_BUCKET)
    .download(storagePath)

  if (error || !data) {
    return `Attachment "${filename}" (PDF) failed to download for parsing.`
  }

  let extractedText = ''
  let pageCount: number | undefined
  try {
    const buffer = Buffer.from(await data.arrayBuffer())
    const pdfParse = require('pdf-parse')
    const parsedPdf = await pdfParse(buffer)
    extractedText = (parsedPdf.text || '').trim()
    pageCount = parsedPdf.numpages
  } catch (parseError) {
    return `Attachment "${filename}" (PDF) could not be text-extracted (${parseError instanceof Error ? parseError.message : 'unknown error'}).`
  }

  if (!extractedText) {
    return `Attachment "${filename}" (PDF, ${pageCount || '?'} pages) appears image-based or empty; text extraction found no content.`
  }

  if (!isLikelyLabReport(filename)) {
    const preview = truncate(extractedText.replace(/\s+/g, ' '), 2200)
    return `Attachment "${filename}" (PDF, ${pageCount || '?'} pages) text preview:\n${preview}`
  }

  const parsedLabs = await parseLabPdf(extractedText)
  const matchedValues = parsedLabs.values.filter((value) => value.markerId !== null)

  if (!matchedValues.length) {
    const preview = truncate(extractedText.replace(/\s+/g, ' '), 1800)
    return (
      `Attachment "${filename}" (PDF) lab parser found no matched markers.` +
      ` Text preview: ${preview}`
    )
  }

  const topMarkers = matchedValues
    .slice(0, 25)
    .map((value) => `${value.markerName}: ${value.value}${value.unit ? ` ${value.unit}` : ''}`)
    .join('; ')

  return (
    `Attachment "${filename}" parsed as lab PDF with ${matchedValues.length} matched markers` +
    `${pageCount ? ` across ${pageCount} pages` : ''}. ` +
    `Top markers: ${topMarkers}`
  )
}

async function summarizeAttachment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  fileId: string,
  attachment?: ChatAttachment
): Promise<string> {
  const storagePath = parseStoragePath(fileId)
  const fallbackName = attachment?.filename || fileId

  if (!storagePath) {
    return `Attachment "${fallbackName}" could not be resolved from this message.`
  }

  if (!storagePath.startsWith(`${userId}/`)) {
    return `Attachment "${fallbackName}" was skipped due to access scope mismatch.`
  }

  const inferredFilename = getFilenameFromPath(storagePath)
  const filename = attachment?.filename || inferredFilename
  const mimeType = attachment?.mimeType || inferMimeType(filename)

  if (mimeType === 'application/pdf') {
    return summarizePdfAttachment(supabase, storagePath, filename)
  }

  if (mimeType === 'text/plain') {
    const { data, error } = await supabase.storage
      .from(CHAT_UPLOAD_BUCKET)
      .download(storagePath)

    if (error || !data) {
      return `Attachment "${filename}" (text) failed to download for parsing.`
    }

    const textContent = truncate(await data.text(), 1800)
    return `Attachment "${filename}" text content:\n${textContent}`
  }

  if (!mimeType.startsWith('image/')) {
    return `Attachment "${filename}" (${mimeType}) uploaded. Direct extraction is not available for this format in chat yet.`
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from(CHAT_UPLOAD_BUCKET)
    .createSignedUrl(storagePath, 60 * 10)

  if (signedError || !signedData?.signedUrl) {
    return `Attachment "${filename}" image URL could not be generated for analysis.`
  }

  const inferredType = inferDiagnosticType(filename)
  const extraction = await extractDiagnosticValues(
    signedData.signedUrl,
    inferredType,
    mimeType
  )

  if (!extraction.success) {
    return `Attachment "${filename}" image analysis failed (${extraction.error || 'unknown error'}).`
  }

  const confidencePct = Math.round(extraction.confidence * 100)
  const extractedJson = truncate(JSON.stringify(extraction.data), 2600)
  return (
    `Attachment "${filename}" analyzed as ${inferredType} ` +
    `(confidence: ${confidencePct}%). Extracted JSON: ${extractedJson}`
  )
}

async function buildAttachmentContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  fileIds: string[],
  attachments: ChatAttachment[]
): Promise<string | null> {
  if (!fileIds.length) {
    return null
  }

  const attachmentById = new Map(attachments.map((a) => [a.id, a]))
  const summaries = await Promise.all(
    fileIds.map((fileId) =>
      summarizeAttachment(supabase, userId, fileId, attachmentById.get(fileId))
    )
  )

  const context = [
    'Uploaded Attachment Context (auto-extracted):',
    ...summaries.map((summary, index) => `${index + 1}. ${summary}`),
  ].join('\n')

  return truncate(context, 12000)
}

function trimHistoryByCharBudget(
  history: ConversationMessage[],
  charBudget: number
): ConversationMessage[] {
  if (!Number.isFinite(charBudget) || charBudget <= 0) {
    return history
  }

  let total = 0
  const kept: ConversationMessage[] = []

  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i]
    const size = msg.content.length

    if (kept.length > 0 && total + size > charBudget) {
      break
    }

    kept.push(msg)
    total += size
  }

  return kept.reverse()
}

function calculateAge(dateOfBirth: string): number {
  const birthDate = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--
  }

  return age
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!user || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user role for content filtering
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = profile?.role || 'member'

    const body = await request.json()
    const {
      message,
      conversationId,
      fileIds: rawFileIds = [],
      attachments: rawAttachments = [],
      force_web_search,
      deep_dive,
    }: {
      message: string
      conversationId?: string
      fileIds?: unknown
      attachments?: unknown
      force_web_search?: boolean
      deep_dive?: boolean
    } = body
    const fileIds = Array.isArray(rawFileIds)
      ? rawFileIds.filter((id): id is string => typeof id === 'string')
      : []
    const attachments = Array.isArray(rawAttachments)
      ? rawAttachments.filter(
          (attachment): attachment is ChatAttachment =>
            typeof attachment === 'object' &&
            attachment !== null &&
            typeof (attachment as ChatAttachment).id === 'string'
        )
      : []

    // Fetch conversation context
    let patientContext: PatientContext | null = null
    let conversationType = 'general'

    if (conversationId) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('patient_id, conversation_type')
        .eq('id', conversationId)
        .single()

      if (conversation?.patient_id) {
        const { data: patient } = await supabase
          .from('patients')
          .select(
            'first_name, last_name, gender, date_of_birth, chief_complaints, medical_history'
          )
          .eq('id', conversation.patient_id)
          .single()

        if (patient) {
          patientContext = {
            first_name: patient.first_name,
            last_name: patient.last_name,
            age: calculateAge(patient.date_of_birth),
            gender: patient.gender,
            chief_complaints: patient.chief_complaints,
            medical_history: patient.medical_history,
          }
        }
      }
      conversationType = conversation?.conversation_type || 'general'
    }

    // Load conversation history
    const historyLimit = Number.isFinite(CHAT_HISTORY_MESSAGE_LIMIT) && CHAT_HISTORY_MESSAGE_LIMIT > 0
      ? CHAT_HISTORY_MESSAGE_LIMIT
      : 400

    let messages: Array<{ role: string; content: string | null }> = []
    if (conversationId) {
      const { data: historyRows } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(historyLimit)

      messages = (historyRows || []).reverse()
    }

    const trimmedHistory = trimHistoryByCharBudget(
      messages.map((m) => ({
        role: m.role as ConversationMessage['role'],
        content: m.content || '',
      })),
      Number.isFinite(CHAT_HISTORY_CHAR_BUDGET) && CHAT_HISTORY_CHAR_BUDGET > 0
        ? CHAT_HISTORY_CHAR_BUDGET
        : 1800000
    )

    const attachmentContext = await buildAttachmentContext(
      supabase,
      user.id,
      fileIds,
      attachments
    )
    const messageWithAttachmentContext = attachmentContext
      ? `${message}\n\n${attachmentContext}`
      : message

    // Forward to Python agent with streaming and role-based filtering
    const response = await fetch(`${getPythonAgentUrl()}/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        message: messageWithAttachmentContext,
        conversation_id: conversationId,
        conversation_type: conversationType,
        patient_context: patientContext,
        history: trimmedHistory,
        file_ids: fileIds,
        user_role: userRole,
        user_id: user.id,
        force_web_search: force_web_search || false,
        deep_dive: deep_dive || false,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: 'Python agent request failed',
      }))
      console.error('[Python Agent Error]', {
        timestamp: new Date().toISOString(),
        userId: user.id,
        conversationId,
        status: response.status,
        error: errorData,
      })
      return NextResponse.json(
        { error: errorData.message || errorData.detail },
        { status: response.status }
      )
    }

    // Stream response with proper chunk forwarding
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const reader = response.body!.getReader()

    // Process chunks in background - forward immediately without buffering
    ;(async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          await writer.write(value)
        }
      } finally {
        await writer.close()
      }
    })()

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    console.error('[Agent Chat Error]', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
