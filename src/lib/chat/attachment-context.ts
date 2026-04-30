import { classifyDiagnosticFile } from '@/lib/diagnostics/file-classification'
import { parseLabPdf } from '@/lib/labs/pdf-parser'
import { extractDiagnosticValues } from '@/lib/vision'
import type { ExtractionResult } from '@/types/diagnostic-extraction'
import type { DiagnosticType } from '@/types/shared'

const CHAT_UPLOAD_BUCKET = 'diagnostics'
const STORAGE_FILE_ID_PREFIX = 'storage:'
const MIN_USEFUL_PDF_TEXT_LENGTH = 80

const PER_FILE_TIMEOUT_MS = 90_000
const TOTAL_ATTACHMENT_TIMEOUT_MS = 150_000

interface ChatAttachmentSupabaseClient {
  storage: {
    from: (_bucket: string) => {
      download: (_path: string) => Promise<{ data: Blob | null; error: unknown }>
      createSignedUrl: (
        _path: string,
        _expiresIn: number
      ) => Promise<{ data: { signedUrl?: string } | null; error: unknown }>
    }
  }
}

export interface ChatAttachment {
  id: string
  filename?: string
  mimeType?: string
}

interface AttachmentContextDeps {
  parsePdfBuffer?: (_buffer: Buffer) => Promise<{ text?: string; numpages?: number }>
  extractDiagnosticValues?: (
    _fileUrl: string,
    _fileType: DiagnosticType,
    _mimeType?: string
  ) => Promise<ExtractionResult<Record<string, unknown>>>
  perFileTimeoutMs?: number
  totalTimeoutMs?: number
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

  if (fileId.startsWith('local_')) {
    return null
  }

  return fileId.includes('/') ? fileId : null
}

function getFilenameFromPath(path: string): string {
  const pathParts = path.split('/')
  const lastPart = pathParts[pathParts.length - 1] || path
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

async function defaultParsePdfBuffer(buffer: Buffer): Promise<{ text?: string; numpages?: number }> {
  // Keep this dynamic require isolated so tests can inject a parser without
  // loading pdfjs workers.
  const pdfParse = require('pdf-parse')
  return pdfParse(buffer)
}

function stringifyExtractionData(data: unknown): string {
  if (!data || typeof data !== 'object') {
    return ''
  }

  const typed = data as Record<string, unknown>
  if (Array.isArray(typed.markers)) {
    const markers = typed.markers
      .slice(0, 35)
      .map((marker) => {
        const row = marker as Record<string, unknown>
        const name = row.name || row.markerName || row.rawName || 'Marker'
        const value = row.value ?? row.percentage ?? ''
        const unit = row.unit ? ` ${row.unit}` : ''
        const status = row.status || row.flag
        return `${name}: ${value}${unit}${status ? ` (${status})` : ''}`
      })
      .join('; ')

    const total = typed.total_markers || typed.totalMarkersFound || typed.markers.length
    return `Extracted markers (${total} total): ${markers}`
  }

  if (Array.isArray(typed.findings)) {
    return `Findings: ${typed.findings.slice(0, 20).join('; ')}`
  }

  return JSON.stringify(data)
}

async function summarizeWithVision(
  supabase: ChatAttachmentSupabaseClient,
  storagePath: string,
  filename: string,
  mimeType: string,
  deps: AttachmentContextDeps
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CHAT_UPLOAD_BUCKET)
    .createSignedUrl(storagePath, 60 * 10)

  if (error || !data?.signedUrl) {
    return `Attachment "${filename}" (${mimeType}) could not be prepared for visual extraction.`
  }

  const fileType = classifyDiagnosticFile(filename, mimeType, {
    preferBloodPanelForUnknownReport: true,
  })
  const extractor = deps.extractDiagnosticValues || extractDiagnosticValues
  const result = await extractor(data.signedUrl, fileType, mimeType)

  if (!result.success) {
    return (
      `Attachment "${filename}" (${mimeType}) visual extraction failed` +
      `${result.error ? `: ${result.error}` : '.'}`
    )
  }

  const extracted = stringifyExtractionData(result.data)
  const confidence = Number.isFinite(result.confidence)
    ? ` Confidence: ${Math.round(result.confidence * 100)}%.`
    : ''

  if (!extracted) {
    return `Attachment "${filename}" (${mimeType}) was visually processed as ${fileType}, but no structured content was extracted.${confidence}`
  }

  return truncate(
    `Attachment "${filename}" (${mimeType}) visually extracted as ${fileType}.${confidence}\n${extracted}`,
    3600
  )
}

async function summarizePdfAttachment(
  supabase: ChatAttachmentSupabaseClient,
  storagePath: string,
  filename: string,
  mimeType: string,
  deps: AttachmentContextDeps
): Promise<string> {
  const diagnosticType = classifyDiagnosticFile(filename, mimeType, {
    preferBloodPanelForUnknownReport: false,
  })

  if (diagnosticType !== 'other') {
    return summarizeWithVision(supabase, storagePath, filename, mimeType, deps)
  }

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
    const parsedPdf = await (deps.parsePdfBuffer || defaultParsePdfBuffer)(buffer)
    extractedText = (parsedPdf.text || '').trim()
    pageCount = parsedPdf.numpages
  } catch (parseError) {
    const visionSummary = await summarizeWithVision(supabase, storagePath, filename, mimeType, deps)
    return (
      `Attachment "${filename}" (PDF) text extraction failed` +
      ` (${parseError instanceof Error ? parseError.message : 'unknown error'}). ` +
      `Visual extraction fallback:\n${visionSummary}`
    )
  }

  if (extractedText.replace(/\s+/g, ' ').length < MIN_USEFUL_PDF_TEXT_LENGTH) {
    const visionSummary = await summarizeWithVision(supabase, storagePath, filename, mimeType, deps)
    return (
      `Attachment "${filename}" (PDF, ${pageCount || '?'} pages) had little or no embedded text. ` +
      `Visual extraction fallback:\n${visionSummary}`
    )
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
  supabase: ChatAttachmentSupabaseClient,
  userId: string,
  fileId: string,
  attachment: ChatAttachment | undefined,
  deps: AttachmentContextDeps
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
    return summarizePdfAttachment(supabase, storagePath, filename, mimeType, deps)
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

  if (mimeType.startsWith('image/')) {
    return summarizeWithVision(supabase, storagePath, filename, mimeType, deps)
  }

  return `Attachment "${filename}" (${mimeType}) uploaded. Direct extraction is not available for this format in chat yet.`
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

export async function buildAttachmentContext(
  supabase: ChatAttachmentSupabaseClient,
  userId: string,
  fileIds: string[],
  attachments: ChatAttachment[],
  deps: AttachmentContextDeps = {}
): Promise<string | null> {
  if (!fileIds.length) {
    return null
  }

  const attachmentById = new Map(attachments.map((a) => [a.id, a]))
  const perFileTimeoutMs = deps.perFileTimeoutMs ?? PER_FILE_TIMEOUT_MS
  const totalTimeoutMs = deps.totalTimeoutMs ?? TOTAL_ATTACHMENT_TIMEOUT_MS

  const filePromises = fileIds.map((fileId) => {
    const attachment = attachmentById.get(fileId)
    const fallbackName = attachment?.filename || fileId
    return withTimeout(
      summarizeAttachment(supabase, userId, fileId, attachment, deps),
      perFileTimeoutMs,
      `Attachment "${fallbackName}" extraction timed out. The file was uploaded successfully, but readable context was not available for this reply.`
    )
  })

  const summaries = await withTimeout(
    Promise.all(filePromises),
    totalTimeoutMs,
    fileIds.map((fileId) => {
      const attachment = attachmentById.get(fileId)
      const fallbackName = attachment?.filename || fileId
      return `Attachment "${fallbackName}" extraction timed out. The file was uploaded successfully, but readable context was not available for this reply.`
    })
  )

  const context = [
    'Uploaded Attachment Context (auto-extracted):',
    ...summaries.map((summary, index) => `${index + 1}. ${summary}`),
  ].join('\n')

  return truncate(context, 12000)
}
