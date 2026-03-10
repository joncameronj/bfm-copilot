import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/diagnostics/[id]/generate-report
 *
 * Triggers a full BFM clinical eval report for the given diagnostic analysis.
 * Delegates to the Python agent which calls Claude Opus 4.6 with all 9 master
 * protocol files inline. Returns a job_id immediately; poll /report for status.
 *
 * [id] can be:
 * - diagnostic_analyses.id
 * - diagnostic_uploads.id (we resolve the analysis from it)
 */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: inputId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve analysis — accept either analysis ID or upload ID
    let analysisId = inputId
    let patientId: string | null = null

    const { data: analysis } = await supabase
      .from('diagnostic_analyses')
      .select('id, patient_id, status, practitioner_id')
      .eq('id', inputId)
      .maybeSingle()

    if (analysis) {
      if (analysis.practitioner_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (analysis.status !== 'complete') {
        return NextResponse.json(
          { error: 'Standard analysis must be complete before generating full eval report' },
          { status: 400 }
        )
      }
      patientId = analysis.patient_id
    } else {
      // Try resolving from upload ID
      const { data: fromUpload } = await supabase
        .from('diagnostic_analyses')
        .select('id, patient_id, status, practitioner_id')
        .eq('diagnostic_upload_id', inputId)
        .eq('practitioner_id', user.id)
        .maybeSingle()

      if (!fromUpload) {
        return NextResponse.json({ error: 'Diagnostic analysis not found' }, { status: 404 })
      }
      if (fromUpload.status !== 'complete') {
        return NextResponse.json(
          { error: 'Standard analysis must be complete before generating full eval report' },
          { status: 400 }
        )
      }
      analysisId = fromUpload.id
      patientId = fromUpload.patient_id
    }

    if (!patientId) {
      return NextResponse.json({ error: 'Analysis has no associated patient' }, { status: 400 })
    }

    // Delegate to Python agent
    const agentUrl = process.env.PYTHON_AGENT_URL || 'http://localhost:8000'
    const agentRes = await fetch(`${agentUrl}/agent/eval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        diagnostic_analysis_id: analysisId,
        patient_id: patientId,
      }),
    })

    if (!agentRes.ok) {
      const errorBody = await agentRes.text()
      return NextResponse.json(
        { error: `Agent error: ${errorBody}` },
        { status: agentRes.status }
      )
    }

    const result = await agentRes.json()

    return NextResponse.json({
      message: 'Full eval report queued',
      data: {
        jobId: result.job_id,
        diagnosticAnalysisId: analysisId,
        patientId,
        status: result.status,
      },
    })
  } catch (error) {
    console.error('Generate report error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/diagnostics/[id]/generate-report
 *
 * Cancels a pending/processing eval report by setting its status to 'cancelled'.
 * The Python background task checks for this status and stops early.
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: inputId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve analysis ID (same logic as POST)
    let analysisId = inputId

    const { data: analysis } = await supabase
      .from('diagnostic_analyses')
      .select('id, practitioner_id')
      .eq('id', inputId)
      .maybeSingle()

    if (analysis) {
      if (analysis.practitioner_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      const { data: fromUpload } = await supabase
        .from('diagnostic_analyses')
        .select('id, practitioner_id')
        .eq('diagnostic_upload_id', inputId)
        .eq('practitioner_id', user.id)
        .maybeSingle()

      if (!fromUpload) {
        return NextResponse.json({ error: 'Diagnostic analysis not found' }, { status: 404 })
      }
      analysisId = fromUpload.id
    }

    // Cancel any pending/processing eval reports for this analysis
    const { error } = await supabase
      .from('diagnostic_eval_reports')
      .update({ status: 'error', error_message: 'Cancelled by user' })
      .eq('diagnostic_analysis_id', analysisId)
      .in('status', ['pending', 'processing'])

    if (error) {
      return NextResponse.json({ error: 'Failed to cancel report' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Report cancelled' })
  } catch (error) {
    console.error('Cancel report error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
