import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPythonAgentUrl } from '@/lib/agent/url'

export const dynamic = 'force-dynamic'

interface PatientEvalRequest {
  diagnosticAnalysisId: string
  patientId: string
}

interface BatchEvalBody {
  patients: PatientEvalRequest[]
}

/**
 * POST /api/diagnostics/eval/batch
 *
 * Trigger full clinical eval reports for 1-5 patients in parallel.
 * All evals run simultaneously via the Python agent's asyncio.gather().
 *
 * Each eval takes ~3 minutes; all complete in ~3 minutes regardless of count.
 * Max 5 patients per batch to control Claude Opus API costs (~$2-4 per patient).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: BatchEvalBody = await request.json()

    if (!body.patients || !Array.isArray(body.patients) || body.patients.length === 0) {
      return NextResponse.json({ error: 'patients array is required' }, { status: 400 })
    }

    if (body.patients.length > 5) {
      return NextResponse.json(
        { error: 'Maximum 5 patients per batch' },
        { status: 400 }
      )
    }

    // Verify user owns all analyses before queuing
    const analysisIds = body.patients.map(p => p.diagnosticAnalysisId)
    const { data: analyses } = await supabase
      .from('diagnostic_analyses')
      .select('id, status, practitioner_id, patient_id')
      .in('id', analysisIds)
      .eq('practitioner_id', user.id)

    if (!analyses || analyses.length !== body.patients.length) {
      return NextResponse.json(
        { error: 'One or more analyses not found or not accessible' },
        { status: 403 }
      )
    }

    const incompleteAnalyses = analyses.filter(a => a.status !== 'complete')
    if (incompleteAnalyses.length > 0) {
      return NextResponse.json(
        {
          error: 'All standard analyses must be complete before generating eval reports',
          incompleteIds: incompleteAnalyses.map(a => a.id),
        },
        { status: 400 }
      )
    }

    // Delegate batch to Python agent
    const agentUrl = getPythonAgentUrl()
    const agentRes = await fetch(`${agentUrl}/agent/eval/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patients: body.patients.map(p => ({
          diagnostic_analysis_id: p.diagnosticAnalysisId,
          patient_id: p.patientId,
        })),
      }),
    })

    if (!agentRes.ok) {
      const errorText = await agentRes.text()
      return NextResponse.json({ error: `Agent error: ${errorText}` }, { status: agentRes.status })
    }

    const result = await agentRes.json()

    return NextResponse.json({
      message: result.message,
      data: {
        total: result.total,
        jobs: result.jobs.map((j: Record<string, unknown>) => ({
          jobId: j.job_id,
          diagnosticAnalysisId: j.diagnostic_analysis_id,
          patientId: j.patient_id,
          status: j.status,
        })),
      },
    })
  } catch (error) {
    console.error('Batch eval error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
