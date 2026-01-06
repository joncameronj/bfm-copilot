import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateDiagnosticAnalysis, saveAnalysisToDatabase } from '@/lib/rag'
import { createReasoningRecords } from '@/lib/rag/reasoning-generator'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60 seconds for AI generation

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/diagnostics/[id]/generate-analysis
// Triggers RAG-powered analysis and protocol recommendation generation
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: diagnosticUploadId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Verify upload belongs to user and has a patient
    const { data: upload, error: uploadError } = await supabase
      .from('diagnostic_uploads')
      .select('id, status, patient_id')
      .eq('id', diagnosticUploadId)
      .eq('user_id', user.id)
      .single()

    if (uploadError || !upload) {
      return NextResponse.json({ error: 'Diagnostic upload not found' }, { status: 404 })
    }

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
      const userRole = profile.role === 'member' ? 'member' : 'practitioner'
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
          },
          supplementation: analysis.supplementation,
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
        .eq('id', pendingAnalysis.id)

      if (updateError) {
        throw new Error(`Failed to update analysis: ${updateError.message}`)
      }

      // Create protocol recommendations with reasoning records
      const recommendationIds: string[] = []
      for (const protocol of analysis.protocols) {
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

        if (!recError && recRecord) {
          recommendationIds.push(recRecord.id)

          // Create reasoning records for explainability
          // This populates the recommendation_reasoning table
          await createReasoningRecords({
            recommendationId: recRecord.id,
            frequencies: protocol.frequencies.map(f => ({
              name: f.name,
              rationale: f.rationale,
              source_reference: f.source_reference,
              diagnostic_trigger: f.diagnostic_trigger,
            })),
            ragChunks: analysis.ragContext,
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
    const { id: diagnosticUploadId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
