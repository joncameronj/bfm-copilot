import type { SupabaseClient } from '@supabase/supabase-js'

import { persistBloodPanelToLabTables } from '@/lib/labs/persist-from-diagnostic'
import { extractDiagnosticValues } from '@/lib/vision'
import { getDefaultVisionModel } from '@/lib/ai/provider'
import { reclassifyDiagnosticFileType } from '@/lib/diagnostics/file-classification'
import type { BloodPanelExtractedData } from '@/types/diagnostic-extraction'
import type { DiagnosticType } from '@/types/shared'

type ExtractionStatus = 'pending' | 'processing' | 'complete' | 'needs_review' | 'error'

interface DiagnosticExtractionRow {
  id: string
  status: ExtractionStatus
  created_at: string
}

export interface DiagnosticFileForExtraction {
  id: string
  upload_id: string
  filename: string
  file_type: DiagnosticType
  mime_type: string
  storage_path: string
  status: string
  diagnostic_extracted_values?: DiagnosticExtractionRow[]
}

export interface UploadExtractionFileResult {
  fileId: string
  filename: string
  originalFileType: DiagnosticType
  effectiveFileType: DiagnosticType
  status: ExtractionStatus | 'skipped'
  wasReclassified: boolean
  confidence?: number
  markerCount?: number
  error?: string
}

export interface UploadExtractionResult {
  uploadId: string
  totalFiles: number
  recognizedFiles: number
  successfulFiles: number
  failedFiles: number
  skippedFiles: number
  processingFiles: number
  results: UploadExtractionFileResult[]
}

export interface ExtractionStageSummary {
  recognizedFiles: number
  pendingFiles: number
  processingFiles: number
  successfulFiles: number
  failedFiles: number
}

const CONFIDENCE_THRESHOLD = 0.7
const STALE_PROCESSING_MS = 10 * 60 * 1000
const SUCCESS_STATUSES = new Set<ExtractionStatus>(['complete', 'needs_review'])

function sortExtractions<T extends { created_at?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
}

function getLatestExtraction(file: Pick<DiagnosticFileForExtraction, 'diagnostic_extracted_values'>) {
  return sortExtractions(file.diagnostic_extracted_values || [])[0]
}

function isStaleProcessing(extraction: DiagnosticExtractionRow | undefined): boolean {
  if (!extraction || extraction.status !== 'processing') {
    return false
  }

  return Date.now() - new Date(extraction.created_at).getTime() > STALE_PROCESSING_MS
}

function countExtractedMarkers(data: unknown, fileType: DiagnosticType): number {
  if (!data || typeof data !== 'object') {
    return 0
  }

  const typedData = data as Record<string, unknown>
  if (fileType === 'blood_panel' && Array.isArray(typedData.markers)) {
    return typedData.markers.length
  }
  if (Array.isArray(typedData.markers)) {
    return typedData.markers.length
  }
  if (Array.isArray(typedData.findings)) {
    return typedData.findings.length
  }

  return 0
}

function createLimiter(concurrency: number) {
  let active = 0
  const queue: Array<() => void> = []

  const next = () => {
    if (active >= concurrency) return
    const run = queue.shift()
    if (!run) return
    active += 1
    run()
  }

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active -= 1
            next()
          })
      })
      next()
    })
  }
}

export function summarizeUploadExtractionStage(
  files: DiagnosticFileForExtraction[]
): ExtractionStageSummary {
  const summary: ExtractionStageSummary = {
    recognizedFiles: 0,
    pendingFiles: 0,
    processingFiles: 0,
    successfulFiles: 0,
    failedFiles: 0,
  }

  for (const file of files) {
    const effectiveType = reclassifyDiagnosticFileType(
      file.file_type,
      file.filename,
      file.mime_type,
      { preferBloodPanelForUnknownReport: true }
    )

    if (effectiveType === 'other') {
      continue
    }

    summary.recognizedFiles += 1
    const latest = getLatestExtraction(file)
    if (!latest) {
      summary.pendingFiles += 1
      continue
    }

    if (SUCCESS_STATUSES.has(latest.status)) {
      summary.successfulFiles += 1
      continue
    }

    if (latest.status === 'processing' && !isStaleProcessing(latest)) {
      summary.processingFiles += 1
      continue
    }

    if (latest.status === 'error') {
      summary.failedFiles += 1
      continue
    }

    summary.pendingFiles += 1
  }

  return summary
}

async function reclassifyFileIfNeeded(
  supabase: SupabaseClient,
  file: DiagnosticFileForExtraction
): Promise<{ effectiveType: DiagnosticType; wasReclassified: boolean }> {
  const effectiveType = reclassifyDiagnosticFileType(
    file.file_type,
    file.filename,
    file.mime_type,
    { preferBloodPanelForUnknownReport: true }
  )

  if (effectiveType !== file.file_type) {
    await supabase
      .from('diagnostic_files')
      .update({ file_type: effectiveType })
      .eq('id', file.id)

    console.log(
      '[Diagnostics][Reclassify]',
      JSON.stringify({
        fileId: file.id,
        filename: file.filename,
        from: file.file_type,
        to: effectiveType,
      })
    )
  }

  return {
    effectiveType,
    wasReclassified: effectiveType !== file.file_type,
  }
}

async function extractSingleFile(
  supabase: SupabaseClient,
  file: DiagnosticFileForExtraction,
  ownerUserId: string,
  extractionModel: string
): Promise<UploadExtractionFileResult> {
  const { effectiveType, wasReclassified } = await reclassifyFileIfNeeded(supabase, file)
  const baseResult = {
    fileId: file.id,
    filename: file.filename,
    originalFileType: file.file_type,
    effectiveFileType: effectiveType,
    wasReclassified,
  }

  if (effectiveType === 'other') {
    return {
      ...baseResult,
      status: 'skipped',
      error: 'No recognized diagnostic type for extraction',
    }
  }

  const latestExtraction = getLatestExtraction(file)
  if (latestExtraction && SUCCESS_STATUSES.has(latestExtraction.status)) {
    return {
      ...baseResult,
      status: latestExtraction.status,
    }
  }

  if (latestExtraction?.status === 'processing' && !isStaleProcessing(latestExtraction)) {
    return {
      ...baseResult,
      status: 'processing',
    }
  }

  let extractionId = latestExtraction?.id
  if (!extractionId) {
    const { data: inserted, error: insertError } = await supabase
      .from('diagnostic_extracted_values')
      .insert({
        diagnostic_file_id: file.id,
        status: 'processing',
        extraction_method: 'vision_api',
        extraction_model: extractionModel,
      })
      .select('id')
      .single()

    if (insertError || !inserted?.id) {
      return {
        ...baseResult,
        status: 'error',
        error: insertError?.message || 'Failed to create extraction record',
      }
    }

    extractionId = inserted.id
  } else {
    await supabase
      .from('diagnostic_extracted_values')
      .update({
        status: 'processing',
        extraction_method: 'vision_api',
        extraction_model: extractionModel,
        error_message: null,
      })
      .eq('id', extractionId)
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('diagnostics')
    .createSignedUrl(file.storage_path, 60 * 10)

  if (signedUrlError || !signedUrlData?.signedUrl) {
    const errorMessage = signedUrlError?.message || 'Failed to create signed URL'
    await supabase
      .from('diagnostic_extracted_values')
      .update({
        status: 'error',
        error_message: errorMessage,
      })
      .eq('id', extractionId)

    await supabase
      .from('diagnostic_files')
      .update({ status: 'error' })
      .eq('id', file.id)

    return {
      ...baseResult,
      status: 'error',
      error: errorMessage,
    }
  }

  const extractionResult = await extractDiagnosticValues(
    signedUrlData.signedUrl,
    effectiveType,
    file.mime_type
  )

  const status: ExtractionStatus = !extractionResult.success
    ? 'error'
    : extractionResult.confidence < CONFIDENCE_THRESHOLD
      ? 'needs_review'
      : 'complete'

  await supabase
    .from('diagnostic_extracted_values')
    .update({
      extracted_data: extractionResult.data,
      extraction_confidence: extractionResult.confidence,
      raw_response: { response: extractionResult.rawResponse },
      status,
      error_message: extractionResult.error || null,
    })
    .eq('id', extractionId)

  await supabase
    .from('diagnostic_files')
    .update({ status: extractionResult.success ? 'processed' : 'error' })
    .eq('id', file.id)

  if (
    effectiveType === 'blood_panel' &&
    extractionResult.success &&
    (status === 'complete' || status === 'needs_review')
  ) {
    const persistResult = await persistBloodPanelToLabTables(
      supabase,
      extractionResult.data as BloodPanelExtractedData,
      file.upload_id,
      ownerUserId
    )

    if (!persistResult.success) {
      console.warn(
        '[Diagnostics][LabPersist]',
        JSON.stringify({
          fileId: file.id,
          filename: file.filename,
          error: persistResult.error,
        })
      )
    }
  }

  const markerCount = countExtractedMarkers(extractionResult.data, effectiveType)
  console.log(
    '[Diagnostics][Extract]',
    JSON.stringify({
      fileId: file.id,
      filename: file.filename,
      fileType: effectiveType,
      status,
      confidence: extractionResult.confidence,
      markerCount,
      error: extractionResult.error || undefined,
    })
  )

  return {
    ...baseResult,
    status,
    confidence: extractionResult.confidence,
    markerCount,
    error: extractionResult.error,
  }
}

export async function ensureUploadExtractions(
  supabase: SupabaseClient,
  uploadId: string
): Promise<UploadExtractionResult> {
  const extractionModel = getDefaultVisionModel()

  const { data: upload, error: uploadError } = await supabase
    .from('diagnostic_uploads')
    .select('id, user_id')
    .eq('id', uploadId)
    .single()

  if (uploadError || !upload?.id || !upload.user_id) {
    throw new Error(uploadError?.message || 'Diagnostic upload not found')
  }

  const { data: files, error: filesError } = await supabase
    .from('diagnostic_files')
    .select(`
      id,
      upload_id,
      filename,
      file_type,
      mime_type,
      storage_path,
      status,
      diagnostic_extracted_values (
        id,
        status,
        created_at
      )
    `)
    .eq('upload_id', uploadId)

  if (filesError) {
    throw new Error(filesError.message)
  }

  const typedFiles = (files || []) as DiagnosticFileForExtraction[]
  const limit = createLimiter(2)
  const settled = await Promise.allSettled(
    typedFiles.map((file) => limit(() => extractSingleFile(supabase, file, upload.user_id, extractionModel)))
  )

  const results: UploadExtractionFileResult[] = settled.map((item, index) => {
    const file = typedFiles[index]
    if (item.status === 'fulfilled') {
      return item.value
    }

    return {
      fileId: file.id,
      filename: file.filename,
      originalFileType: file.file_type,
      effectiveFileType: file.file_type,
      status: 'error',
      wasReclassified: false,
      error: item.reason instanceof Error ? item.reason.message : 'Unknown extraction error',
    }
  })

  const recognizedResults = results.filter((result) => result.effectiveFileType !== 'other')
  const successfulFiles = results.filter((result) => result.status === 'complete' || result.status === 'needs_review').length
  const failedFiles = results.filter((result) => result.status === 'error').length
  const skippedFiles = results.filter((result) => result.status === 'skipped').length
  const processingFiles = results.filter((result) => result.status === 'processing').length

  return {
    uploadId,
    totalFiles: typedFiles.length,
    recognizedFiles: recognizedResults.length,
    successfulFiles,
    failedFiles,
    skippedFiles,
    processingFiles,
    results,
  }
}
