import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { RecordOutcomeInput } from '@/types/diagnostic-analysis'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/protocol-executions/[id]
// Get execution details
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: executionId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: execution, error } = await supabase
      .from('protocol_executions')
      .select(`
        *,
        protocol_recommendation:protocol_recommendations (
          id,
          title,
          description,
          category,
          recommended_frequencies
        ),
        patient:patients (
          id,
          first_name,
          last_name
        )
      `)
      .eq('id', executionId)
      .eq('practitioner_id', user.id)
      .single()

    if (error || !execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 })
    }

    return NextResponse.json({ data: execution })

  } catch (error) {
    console.error('Get execution error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/protocol-executions/[id]
// Record outcome for a protocol execution
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id: executionId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: RecordOutcomeInput = await request.json()

    // Validate outcome value
    if (!['positive', 'negative', 'neutral', 'pending'].includes(body.outcome)) {
      return NextResponse.json(
        { error: 'Invalid outcome value' },
        { status: 400 }
      )
    }

    // Verify execution exists and belongs to user
    const { data: execution, error: execError } = await supabase
      .from('protocol_executions')
      .select('id, practitioner_id, patient_id')
      .eq('id', executionId)
      .eq('practitioner_id', user.id)
      .single()

    if (execError || !execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 })
    }

    // Update execution with outcome
    const { error: updateError } = await supabase
      .from('protocol_executions')
      .update({
        outcome: body.outcome,
        outcome_notes: body.outcomeNotes,
        outcome_recorded_at: new Date().toISOString(),
      })
      .eq('id', executionId)

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update outcome: ${updateError.message}` },
        { status: 500 }
      )
    }

    // Log usage event
    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_type: 'protocol_outcome_recorded',
      metadata: {
        execution_id: executionId,
        patient_id: execution.patient_id,
        outcome: body.outcome,
      },
    })

    return NextResponse.json({
      message: 'Outcome recorded successfully',
      data: {
        executionId,
        outcome: body.outcome,
      }
    })

  } catch (error) {
    console.error('Record outcome error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
