import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateDiagnosticAnalysis } from '@/lib/rag'
import { createReasoningRecords } from '@/lib/rag/reasoning-generator'
import { extractDiagnosticValues } from '@/lib/vision'
import { persistBloodPanelToLabTables } from '@/lib/labs/persist-from-diagnostic'
import { getDefaultVisionModel } from '@/lib/ai/provider'
import type { DiagnosticType } from '@/types/shared'
import type { BloodPanelExtractedData } from '@/types/diagnostic-extraction'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Allow up to 5 minutes for multi-file extraction + AI generation

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
// Triggers RAG-powered analysis and protocol recommendation generation
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
      .select('id, status')
      .eq('diagnostic_upload_id', diagnosticUploadId)
      .single()

    if (existingAnalysis) {
      return NextResponse.json({
        message: 'Analysis already exists',
        data: { analysisId: existingAnalysis.id, status: existingAnalysis.status }
      })
    }

    // AUTO-EXTRACT: Ensure all files are extracted before generating analysis
    // This bridges the gap between upload and analysis, ensuring blood panels get persisted to lab tables
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

    const extractionResults: Array<{ fileId: string; fileType: string; status: string; error?: string }> = []

    if (!filesError && files) {
      for (const file of files) {
        // Check if file already has usable extraction (complete or needs_review both have data)
        const existingExtraction = (file.diagnostic_extracted_values as Array<{ id: string; status: string }>)?.[0]
        if (existingExtraction?.status === 'complete' || existingExtraction?.status === 'needs_review') {
          extractionResults.push({ fileId: file.id, fileType: file.file_type, status: existingExtraction.status })
          continue // Skip already extracted files
        }

        try {
          // Generate short-lived signed URL (diagnostics bucket is private).
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('diagnostics')
            .createSignedUrl(file.storage_path, 60 * 10)

          if (signedUrlError || !signedUrlData?.signedUrl) {
            console.warn(
              `[Auto-Extract] Failed to create signed URL for file ${file.id}:`,
              signedUrlError
            )
            extractionResults.push({ fileId: file.id, fileType: file.file_type, status: 'error', error: `Signed URL failed: ${signedUrlError?.message || 'no URL returned'}` })
            continue
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
              extractionResults.push({ fileId: file.id, fileType: file.file_type, status: 'error', error: `DB insert failed: ${insertError.message}` })
              continue
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
          // This ensures labs uploaded via diagnostics appear in patient Lab Results section
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

          extractionResults.push({ fileId: file.id, fileType: file.file_type, status, error: result.error })
          console.log(`[Auto-Extract] Extracted file ${file.id} (${file.file_type}): status=${status}, confidence=${result.confidence}`)
        } catch (extractError) {
          console.error(`[Auto-Extract] Failed to extract file ${file.id}:`, extractError)
          extractionResults.push({ fileId: file.id, fileType: file.file_type, status: 'error', error: extractError instanceof Error ? extractError.message : 'Unknown error' })
          // Continue with other files - don't fail the whole analysis
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
      // Generate the analysis with RAG
      const userRole = profile?.role === 'member' ? 'member' : 'practitioner'
      const analysis = await generateDiagnosticAnalysis(
        diagnosticUploadId,
        upload.patient_id,
        user.id,
        userRole
      )

      // Update the analysis record with results
      const { error: updateError } = await supabase
        .from('diagnostic_analyses')
        .update({
          summary: analysis.summary,
          raw_analysis: {
            protocols: analysis.protocols,
            supplementation: analysis.supplementation,
            eval_report: analysis.evalReport || null,
          },
          supplementation: analysis.supplementation,
          status: 'complete',
          rag_context: {},
        })
        .eq('id', pendingAnalysis.id)

      if (updateError) {
        throw new Error(`Failed to update analysis: ${updateError.message}`)
      }

      // Create protocol recommendations with reasoning records
      const recommendationIds: string[] = []
      console.log(`[Demo Mode Debug] Creating ${analysis.protocols.length} protocol recommendations`)
      for (const protocol of analysis.protocols) {
        console.log(`[Demo Mode Debug] Saving protocol: "${protocol.title}" (category: ${protocol.category}, frequencies: ${protocol.frequencies.length})`)
        const { data: recRecord, error: recError } = await supabase
          .from('protocol_recommendations')
          .insert({
            diagnostic_analysis_id: pendingAnalysis.id,
            patient_id: upload.patient_id,
            title: protocol.title,
            description: protocol.description,
            category: protocol.category,
            recommended_frequencies: protocol.frequencies,
            supplementation: analysis.supplementation,
            priority: protocol.priority,
            status: 'recommended',
          })
          .select('id')
          .single()

        if (recError) {
          console.error(`[Demo Mode Debug] Failed to save protocol "${protocol.title}":`, recError)
        }

        if (!recError && recRecord) {
          recommendationIds.push(recRecord.id)

          // Create reasoning records for explainability
          await createReasoningRecords({
            recommendationId: recRecord.id,
            frequencies: protocol.frequencies.map(f => ({
              name: f.name,
              rationale: f.rationale,
              source_reference: f.source_reference,
              diagnostic_trigger: f.diagnostic_trigger,
            })),
            ragChunks: [],
            diagnosticData: analysis.extractedData,
            reasoningChain: analysis.reasoningChain || [],
          })
        }
      }

      // Update diagnostic upload status to complete
      await supabase
        .from('diagnostic_uploads')
        .update({ status: 'complete' })
        .eq('id', diagnosticUploadId)

      // Log usage event
      await supabase.from('usage_events').insert({
        user_id: user.id,
        event_type: 'diagnostic_analysis_generated',
        metadata: {
          diagnostic_upload_id: diagnosticUploadId,
          analysis_id: pendingAnalysis.id,
          patient_id: upload.patient_id,
          protocol_count: analysis.protocols.length,
        },
      })

      return NextResponse.json({
        message: 'Analysis generated successfully',
        data: {
          analysisId: pendingAnalysis.id,
          status: 'complete',
          protocolCount: analysis.protocols.length,
          recommendationIds,
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
// Get the analysis status/results for a diagnostic upload
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

    return NextResponse.json({
      data: {
        id: analysis.id,
        diagnosticUploadId: analysis.diagnostic_upload_id,
        patientId: analysis.patient_id,
        summary: analysis.summary,
        status: analysis.status,
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
