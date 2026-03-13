import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPythonAgentUrl } from '@/lib/agent/url'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/diagnostics/[id]/report
 *
 * Fetch the eval report for a diagnostic analysis.
 * [id] = diagnostic_analyses.id
 *
 * Returns:
 * - status: pending | processing | complete | error
 * - report: full EvalReport JSON (when complete)
 * - urgencyRating, dealBreakerCount
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: analysisId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns this analysis
    const { data: analysis } = await supabase
      .from('diagnostic_analyses')
      .select('id, practitioner_id')
      .eq('id', analysisId)
      .maybeSingle()

    if (!analysis || analysis.practitioner_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Fetch from Python agent (which reads from diagnostic_eval_reports)
    const agentUrl = getPythonAgentUrl()
    const agentRes = await fetch(
      `${agentUrl}/agent/eval/by-analysis/${analysisId}`,
      { cache: 'no-store' }
    )

    if (agentRes.status === 404) {
      return NextResponse.json({ data: null })
    }

    if (!agentRes.ok) {
      return NextResponse.json({ error: 'Agent error' }, { status: 502 })
    }

    const rec = await agentRes.json()

    if (!rec) {
      return NextResponse.json({ data: null })
    }

    return NextResponse.json({
      data: {
        id: rec.id,
        status: rec.status,
        report: rec.report,
        urgencyRating: rec.urgency_rating,
        dealBreakerCount: rec.deal_breaker_count,
        errorMessage: rec.error_message,
        createdAt: rec.created_at,
        updatedAt: rec.updated_at,
      },
    })
  } catch (error) {
    console.error('Get report error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
