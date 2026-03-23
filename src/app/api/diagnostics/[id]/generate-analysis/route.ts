import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateDiagnosticAnalysis, finalizeAnalysisFromEvalReport } from '@/lib/rag'
import { createReasoningRecords } from '@/lib/rag/reasoning-generator'
import { extractDiagnosticValues } from '@/lib/vision'
import { persistBloodPanelToLabTables } from '@/lib/labs/persist-from-diagnostic'
import { getDefaultVisionModel } from '@/lib/ai/provider'
import type { DiagnosticType } from '@/types/shared'
import type { BloodPanelExtractedData } from '@/types/diagnostic-extraction'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // Parallel extraction + fire background job

interface RouteParams {
  params: Promise<{ id: string }>
}

type UploadLookup = {
  id: string
  status: string
  patient_id: string | null
}

/**
 * Resolve a diagnostic upload from multiple ID types:
 * - direct diagnostic_uploads.id
 * - diagnostic_files.id (maps to upload_id)
 * - diagnostic_analyses.id (maps to diagnostic_upload_id)
 */
async function resolveDiagnosticUpload(
  supabase: Awaited<ReturnType<typeof createClient>>,
  inputId: string,
  userId: string
): Promise<UploadLookup | null> {
  const loadUploadById = async (uploadId: string): Promise<UploadLookup | null> => {
    const { data } = await supabase
      .from('diagnostic_uploads')
      .select('id, status, patient_id')
      .eq('id', uploadId)
      .eq('user_id', userId)
      .maybeSingle()
    return data
  }

  const directUpload = await loadUploadById(inputId)
  if (directUpload) {
    return directUpload
  }

  const { data: fileRef } = await supabase
    .from('diagnostic_files')
    .select('upload_id')
    .eq('id', inputId)
    .maybeSingle()

  if (fileRef?.upload_id) {
    const uploadFromFile = await loadUploadById(fileRef.upload_id)
    if (uploadFromFile) {
      return uploadFromFile
    }
  }

  const { data: analysisRef } = await supabase
    .from('diagnostic_analyses')
    .select('diagnostic_upload_id')
    .eq('id', inputId)
    .eq('practitioner_id', userId)
    .maybeSingle()

  if (analysisRef?.diagnostic_upload_id) {
    const uploadFromAnalysis = await loadUploadById(analysisRef.diagnostic_upload_id)
    if (uploadFromAnalysis) {
      return uploadFromAnalysis
    }
  }

  return null
}

// POST /api/diagnostics/[id]/generate-analysis
// Phase 1: Extract files + fire eval background job → returns immediately
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: inputId } = await params
    const visionModel = getDefaultVisionModel()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user role (fallback to practitioner for resilience)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.warn('Profile lookup failed while generating analysis:', profileError.message)
    }

    // Resolve upload across upload/file/analysis ID types
    const upload = await resolveDiagnosticUpload(supabase, inputId, user.id)
    if (!upload) {
      return NextResponse.json(
        { error: 'Diagnostic upload not found (checked upload, file, and analysis IDs)' },
        { status: 404 }
      )
    }
    const diagnosticUploadId = upload.id

    if (!upload.patient_id) {
      return NextResponse.json(
        { error: 'Diagnostic upload must be linked to a patient before generating analysis' },
        { status: 400 }
      )
    }

    // Check if analysis already exists
    const { data: existingAnalysis } = await supabase
      .from('diagnostic_analyses')
      .select('id, status, created_at')
      .eq('diagnostic_upload_id', diagnosticUploadId)
      .single()

    if (existingAnalysis) {
      const isComplete = existingAnalysis.status === 'complete'
      const isError = existingAnalysis.status === 'error'
      const isStaleProcessing = existingAnalysis.status === 'processing' &&
        (Date.now() - new Date(existingAnalysis.created_at).getTime()) > 15 * 60 * 1000

      if (isComplete) {
        return NextResponse.json({
          message: 'Analysis already exists',
          data: { analysisId: existingAnalysis.id, status: existingAnalysis.status }
        })
      }

      if (!isError && !isStaleProcessing) {
        // Legitimately processing (< 15 min old) — return current status
        return NextResponse.json({
          message: 'Analysis is being generated',
          data: { analysisId: existingAnalysis.id, status: existingAnalysis.status }
        })
      }

      // Stale processing (>15 min) or error — clean up and retry
      console.log(`[Generate] Cleaning up stale analysis ${existingAnalysis.id} (status=${existingAnalysis.status})`)
      await supabase
        .from('diagnostic_eval_reports')
        .delete()
        .eq('diagnostic_analysis_id', existingAnalysis.id)
      await supabase
        .from('protocol_recommendations')
        .delete()
        .eq('diagnostic_analysis_id', existingAnalysis.id)
      await supabase
        .from('diagnostic_analyses')
        .delete()
        .eq('id', existingAnalysis.id)
    }

    // AUTO-EXTRACT: Ensure all files are extracted before generating analysis
    const { data: files, error: filesError } = await supabase
      .from('diagnostic_files')
      .select(`
        id,
        filename,
        file_type,
        mime_type,
        storage_path,
        upload_id,
        diagnostic_extracted_values(id, status)
      `)
      .eq('upload_id', diagnosticUploadId)

    type ExtractionResult = { fileId: string; fileType: string; status: string; error?: string }
    const extractionResults: ExtractionResult[] = []

    // Inline concurrency limiter (avoids ESM issues with p-limit package)
    function pLimit(concurrency: number) {
      let active = 0
      const queue: Array<() => void> = []
      const next = () => { if (queue.length > 0 && active < concurrency) { active++; queue.shift()!() } }
      return <T>(fn: () => Promise<T>): Promise<T> =>
        new Promise<T>((resolve, reject) => {
          queue.push(() => fn().then(resolve, reject).finally(() => { active--; next() }))
          next()
        })
    }

    if (!filesError && files) {
      const limit = pLimit(3) // Max 3 concurrent vision API calls

      // Separate already-extracted files from those needing extraction
      const filesToExtract: typeof files = []
      for (const file of files) {
        const existingExtraction = (file.diagnostic_extracted_values as Array<{ id: string; status: string }>)?.[0]
        if (existingExtraction?.status === 'complete' || existingExtraction?.status === 'needs_review') {
          extractionResults.push({ fileId: file.id, fileType: file.file_type, status: existingExtraction.status })
        } else {
          filesToExtract.push(file)
        }
      }

      // Extract files in parallel (concurrency 3)
      const settled = await Promise.allSettled(
        filesToExtract.map(file => limit(async (): Promise<ExtractionResult> => {
          const existingExtraction = (file.diagnostic_extracted_values as Array<{ id: string; status: string }>)?.[0]

          // Generate short-lived signed URL (diagnostics bucket is private).
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('diagnostics')
            .createSignedUrl(file.storage_path, 60 * 10)

          if (signedUrlError || !signedUrlData?.signedUrl) {
            console.warn(`[Auto-Extract] Failed to create signed URL for file ${file.id}:`, signedUrlError)
            return { fileId: file.id, fileType: file.file_type, status: 'error', error: `Signed URL failed: ${signedUrlError?.message || 'no URL returned'}` }
          }

          // Create or update extraction record
          let extractionId = existingExtraction?.id
          if (!extractionId) {
            const { data: newExtraction, error: insertError } = await supabase
              .from('diagnostic_extracted_values')
              .insert({
                diagnostic_file_id: file.id,
                status: 'processing',
                extraction_method: 'vision_api',
                extraction_model: visionModel,
              })
              .select('id')
              .single()

            if (insertError) {
              console.error(`[Auto-Extract] Failed to insert extraction record for file ${file.id}:`, insertError)
              return { fileId: file.id, fileType: file.file_type, status: 'error', error: `DB insert failed: ${insertError.message}` }
            }
            extractionId = newExtraction?.id
          } else {
            await supabase
              .from('diagnostic_extracted_values')
              .update({ status: 'processing' })
              .eq('id', extractionId)
          }

          // Perform extraction
          const result = await extractDiagnosticValues(
            signedUrlData.signedUrl,
            file.file_type as DiagnosticType,
            file.mime_type
          )

          // Determine status based on confidence
          const CONFIDENCE_THRESHOLD = 0.7
          const status = !result.success
            ? 'error'
            : result.confidence < CONFIDENCE_THRESHOLD
              ? 'needs_review'
              : 'complete'

          // Update extraction record
          if (extractionId) {
            const { error: updateError } = await supabase
              .from('diagnostic_extracted_values')
              .update({
                extracted_data: result.data,
                extraction_confidence: result.confidence,
                raw_response: { response: result.rawResponse },
                status,
                error_message: result.error || null,
              })
              .eq('id', extractionId)

            if (updateError) {
              console.error(`[Auto-Extract] Failed to update extraction record for file ${file.id}:`, updateError)
            }
          }

          // Mark file as processed
          await supabase.from('diagnostic_files').update({ status: 'processed' }).eq('id', file.id)

          // CRITICAL: Persist blood panel to lab tables
          if (file.file_type === 'blood_panel' && result.success && status === 'complete') {
            const labPersistResult = await persistBloodPanelToLabTables(
              supabase,
              result.data as BloodPanelExtractedData,
              file.upload_id,
              user.id
            )

            if (labPersistResult.success) {
              console.log(
                `[Auto-Extract] Blood panel persisted to lab tables: ${labPersistResult.labResultId}, ` +
                `${labPersistResult.labValuesCount} values`
              )
            } else {
              console.warn('[Auto-Extract] Failed to persist blood panel to lab tables:', labPersistResult.error)
            }
          }

          console.log(`[Auto-Extract] Extracted file ${file.id} (${file.file_type}): status=${status}, confidence=${result.confidence}`)
          return { fileId: file.id, fileType: file.file_type, status, error: result.error }
        }))
      )

      // Collect results from settled promises
      for (const result of settled) {
        if (result.status === 'fulfilled') {
          extractionResults.push(result.value)
        } else {
          console.error('[Auto-Extract] Extraction task failed:', result.reason)
          extractionResults.push({ fileId: 'unknown', fileType: 'unknown', status: 'error', error: result.reason?.message || 'Unknown error' })
        }
      }
    }

    // Log extraction summary
    const successCount = extractionResults.filter(r => r.status === 'complete' || r.status === 'needs_review').length
    console.log(`[Auto-Extract] ${successCount}/${extractionResults.length} files extracted successfully`)

    if (successCount === 0 && extractionResults.length > 0) {
      const failures = extractionResults.map(r => `${r.fileType}: ${r.error || r.status}`).join('; ')
      return NextResponse.json(
        { error: `All file extractions failed: ${failures}` },
        { status: 400 }
      )
    }

    // Create pending analysis record
    const { data: pendingAnalysis, error: pendingError } = await supabase
      .from('diagnostic_analyses')
      .insert({
        diagnostic_upload_id: diagnosticUploadId,
        patient_id: upload.patient_id,
        practitioner_id: user.id,
        summary: '',
        status: 'processing',
      })
      .select('id')
      .single()

    if (pendingError || !pendingAnalysis) {
      return NextResponse.json(
        { error: 'Failed to create analysis record' },
        { status: 500 }
      )
    }

    // Update diagnostic upload status
    await supabase
      .from('diagnostic_uploads')
      .update({ status: 'processing' })
      .eq('id', diagnosticUploadId)

    try {
      // Fire eval background job (returns immediately — does NOT block)
      const userRole = profile?.role === 'member' ? 'member' : 'practitioner'
      await generateDiagnosticAnalysis(
        diagnosticUploadId,
        upload.patient_id,
        user.id,
        userRole
      )

      // Log usage event
      await supabase.from('usage_events').insert({
        user_id: user.id,
        event_type: 'diagnostic_analysis_generated',
        metadata: {
          diagnostic_upload_id: diagnosticUploadId,
          analysis_id: pendingAnalysis.id,
          patient_id: upload.patient_id,
        },
      })

      // Return immediately — analysis is processing in background
      return NextResponse.json({
        message: 'Analysis started — eval agent is processing',
        data: {
          analysisId: pendingAnalysis.id,
          status: 'processing',
        }
      })

    } catch (genError) {
      // Update analysis status to error
      await supabase
        .from('diagnostic_analyses')
        .update({
          status: 'error',
          error_message: genError instanceof Error ? genError.message : 'Unknown error',
        })
        .eq('id', pendingAnalysis.id)

      // Revert diagnostic upload status
      await supabase
        .from('diagnostic_uploads')
        .update({ status: 'error' })
        .eq('id', diagnosticUploadId)

      throw genError
    }

  } catch (error) {
    console.error('Generate analysis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/diagnostics/[id]/generate-analysis
// Phase 2: Check eval status → finalize if ready → return current status
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: inputId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const upload = await resolveDiagnosticUpload(supabase, inputId, user.id)
    if (!upload) {
      return NextResponse.json({ error: 'Diagnostic upload not found' }, { status: 404 })
    }
    const diagnosticUploadId = upload.id

    // Get analysis with recommendations
    const { data: analysis, error: analysisError } = await supabase
      .from('diagnostic_analyses')
      .select(`
        *,
        protocol_recommendations (
          id,
          title,
          description,
          category,
          recommended_frequencies,
          supplementation,
          priority,
          status,
          created_at
        )
      `)
      .eq('diagnostic_upload_id', diagnosticUploadId)
      .single()

    if (analysisError) {
      if (analysisError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
      }
      throw analysisError
    }

    // ASYNC FINALIZATION: If analysis is still processing, check if eval is done
    if (analysis.status === 'processing' && analysis.patient_id) {
      try {
        const finalized = await finalizeAnalysisFromEvalReport(
          analysis.id,
          diagnosticUploadId,
          analysis.patient_id,
        )

        if (finalized) {
          // Eval is done — save protocols and update analysis to complete
          console.log(`[Finalize] Completing analysis ${analysis.id} with ${finalized.protocols.length} protocols`)

          // Update the analysis record with results
          const { error: updateError } = await supabase
            .from('diagnostic_analyses')
            .update({
              summary: finalized.summary,
              raw_analysis: {
                protocols: finalized.protocols,
                supplementation: finalized.supplementation,
                eval_report: finalized.evalReport || null,
              },
              supplementation: finalized.supplementation,
              status: 'complete',
              rag_context: {},
            })
            .eq('id', analysis.id)

          if (updateError) {
            throw new Error(`Failed to update analysis: ${updateError.message}`)
          }

          // Create protocol recommendations with reasoning records
          const recommendationIds: string[] = []
          for (const protocol of finalized.protocols) {
            const { data: recRecord, error: recError } = await supabase
              .from('protocol_recommendations')
              .insert({
                diagnostic_analysis_id: analysis.id,
                patient_id: analysis.patient_id,
                title: protocol.title,
                description: protocol.description,
                category: protocol.category,
                recommended_frequencies: protocol.frequencies,
                supplementation: finalized.supplementation,
                priority: protocol.priority,
                status: 'recommended',
              })
              .select('id')
              .single()

            if (!recError && recRecord) {
              recommendationIds.push(recRecord.id)

              await createReasoningRecords({
                recommendationId: recRecord.id,
                frequencies: protocol.frequencies.map(f => ({
                  name: f.name,
                  rationale: f.rationale,
                  source_reference: f.source_reference,
                  diagnostic_trigger: f.diagnostic_trigger,
                })),
                ragChunks: [],
                diagnosticData: finalized.extractedData,
                reasoningChain: finalized.reasoningChain || [],
              })
            }
          }

          // Update diagnostic upload status to complete
          await supabase
            .from('diagnostic_uploads')
            .update({ status: 'complete' })
            .eq('id', diagnosticUploadId)

          // Re-fetch the completed analysis with recommendations
          const { data: completedAnalysis } = await supabase
            .from('diagnostic_analyses')
            .select(`
              *,
              protocol_recommendations (
                id, title, description, category,
                recommended_frequencies, supplementation,
                priority, status, created_at
              )
            `)
            .eq('id', analysis.id)
            .single()

          if (completedAnalysis) {
            return NextResponse.json({
              data: {
                id: completedAnalysis.id,
                diagnosticUploadId: completedAnalysis.diagnostic_upload_id,
                patientId: completedAnalysis.patient_id,
                summary: completedAnalysis.summary,
                status: completedAnalysis.status,
                errorMessage: completedAnalysis.error_message,
                recommendations: completedAnalysis.protocol_recommendations || [],
                createdAt: completedAnalysis.created_at,
                updatedAt: completedAnalysis.updated_at,
              }
            })
          }
        }
        // If finalized is null, eval is still processing — fall through to return current status
      } catch (finalizeError) {
        console.error(`[Finalize] Error finalizing analysis ${analysis.id}:`, finalizeError)
        // Update analysis to error state
        await supabase
          .from('diagnostic_analyses')
          .update({
            status: 'error',
            error_message: finalizeError instanceof Error ? finalizeError.message : 'Finalization failed',
          })
          .eq('id', analysis.id)

        await supabase
          .from('diagnostic_uploads')
          .update({ status: 'error' })
          .eq('id', diagnosticUploadId)

        const errorMsg = finalizeError instanceof Error ? finalizeError.message : 'Finalization failed'
        return NextResponse.json({
          data: {
            id: analysis.id,
            diagnosticUploadId: analysis.diagnostic_upload_id,
            patientId: analysis.patient_id,
            summary: analysis.summary,
            status: 'error',
            errorMessage: errorMsg,
            recommendations: [],
            createdAt: analysis.created_at,
            updatedAt: analysis.updated_at,
          }
        })
      }
    }

    // Determine pipeline stage for frontend progress display
    let stage: string | undefined
    if (analysis.status === 'processing') {
      const { data: evalReport } = await supabase
        .from('diagnostic_eval_reports')
        .select('status')
        .eq('diagnostic_analysis_id', analysis.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!evalReport) {
        stage = 'extracting'
      } else if (evalReport.status === 'pending') {
        stage = 'queued'
      } else if (evalReport.status === 'processing') {
        stage = 'analyzing'
      }
    }

    return NextResponse.json({
      data: {
        id: analysis.id,
        diagnosticUploadId: analysis.diagnostic_upload_id,
        patientId: analysis.patient_id,
        summary: analysis.summary,
        status: analysis.status,
        stage,
        errorMessage: analysis.error_message,
        recommendations: analysis.protocol_recommendations || [],
        createdAt: analysis.created_at,
        updatedAt: analysis.updated_at,
      }
    })

  } catch (error) {
    console.error('Get analysis error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
