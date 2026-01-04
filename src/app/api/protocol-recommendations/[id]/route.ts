import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/protocol-recommendations/[id]
// Get recommendation details with executions
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: recommendationId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: recommendation, error } = await supabase
      .from('protocol_recommendations')
      .select(`
        *,
        diagnostic_analysis:diagnostic_analyses (
          id,
          summary,
          practitioner_id
        ),
        patient:patients (
          id,
          first_name,
          last_name
        ),
        protocol_executions (
          id,
          executed_at,
          frequencies_used,
          duration_minutes,
          notes,
          outcome,
          outcome_notes,
          outcome_recorded_at
        )
      `)
      .eq('id', recommendationId)
      .single()

    if (error || !recommendation) {
      return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 })
    }

    // Verify access - relation returns object with .single(), but TS thinks it's array
    const analysis = recommendation.diagnostic_analysis as unknown as { practitioner_id: string }
    if (analysis.practitioner_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json({ data: recommendation })

  } catch (error) {
    console.error('Get recommendation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/protocol-recommendations/[id]
// Update recommendation (e.g., decline)
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id: recommendationId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Verify recommendation exists and user has access
    const { data: recommendation, error: recError } = await supabase
      .from('protocol_recommendations')
      .select(`
        id,
        diagnostic_analysis:diagnostic_analyses!inner (
          practitioner_id
        )
      `)
      .eq('id', recommendationId)
      .single()

    if (recError || !recommendation) {
      return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 })
    }

    const analysis = recommendation.diagnostic_analysis as unknown as { practitioner_id: string }
    if (analysis.practitioner_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Update recommendation
    const updateData: Record<string, unknown> = {}
    if (body.status && ['recommended', 'executed', 'declined'].includes(body.status)) {
      updateData.status = body.status
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('protocol_recommendations')
      .update(updateData)
      .eq('id', recommendationId)

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Recommendation updated',
      data: { id: recommendationId, ...updateData }
    })

  } catch (error) {
    console.error('Update recommendation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
