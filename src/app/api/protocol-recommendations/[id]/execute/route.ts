import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { ExecuteRecommendationInput } from '@/types/diagnostic-analysis'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/protocol-recommendations/[id]/execute
// Execute a protocol recommendation (practitioner marks they ran it)
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: recommendationId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body: ExecuteRecommendationInput = await request.json()

    // Verify recommendation exists and user has access
    const { data: recommendation, error: recError } = await supabase
      .from('protocol_recommendations')
      .select(`
        id,
        patient_id,
        status,
        diagnostic_analysis:diagnostic_analyses!inner (
          practitioner_id
        )
      `)
      .eq('id', recommendationId)
      .single()

    if (recError || !recommendation) {
      return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 })
    }

    // Verify user is the practitioner
    // The relation returns an object with .single(), but TS thinks it's an array
    const analysis = recommendation.diagnostic_analysis as unknown as { practitioner_id: string }
    if (analysis.practitioner_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Create execution record
    const { data: execution, error: execError } = await supabase
      .from('protocol_executions')
      .insert({
        protocol_recommendation_id: recommendationId,
        patient_id: recommendation.patient_id,
        practitioner_id: user.id,
        frequencies_used: body.frequenciesUsed || [],
        duration_minutes: body.durationMinutes,
        notes: body.notes,
        outcome: 'pending',
        executed_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (execError || !execution) {
      return NextResponse.json(
        { error: `Failed to create execution record: ${execError?.message}` },
        { status: 500 }
      )
    }

    // Update recommendation status to executed
    await supabase
      .from('protocol_recommendations')
      .update({ status: 'executed' })
      .eq('id', recommendationId)

    // Log usage event
    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_type: 'protocol_recommendation_executed',
      metadata: {
        recommendation_id: recommendationId,
        execution_id: execution.id,
        patient_id: recommendation.patient_id,
      },
    })

    return NextResponse.json({
      message: 'Protocol executed successfully',
      data: {
        executionId: execution.id,
        recommendationId,
        status: 'executed',
      }
    })

  } catch (error) {
    console.error('Execute recommendation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
