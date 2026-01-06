import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { BatchExecutionRequest } from '@/types/diagnostic-analysis'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/diagnostics/[id]/log-protocols
// Batch log selected frequencies to treatment session and archive analysis
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: analysisId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: BatchExecutionRequest = await request.json()

    // Verify analysis exists and user has access
    const { data: analysis, error: analysisError } = await supabase
      .from('diagnostic_analyses')
      .select('id, patient_id, practitioner_id, is_archived')
      .eq('id', analysisId)
      .single()

    if (analysisError || !analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
    }

    if (analysis.practitioner_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (analysis.is_archived) {
      return NextResponse.json({ error: 'Analysis already archived' }, { status: 400 })
    }

    // Create treatment session
    const { data: session, error: sessionError } = await supabase
      .from('treatment_sessions')
      .insert({
        patient_id: body.patientId,
        practitioner_id: user.id,
        session_date: body.sessionDate,
        session_time: body.sessionTime,
        frequencies_used: body.frequencies.map(f => ({
          id: f.frequencyId,
          name: f.frequencyName,
        })),
        effect: body.effect === 'pending' ? 'nil' : body.effect, // treatment_sessions uses 'nil' instead of 'pending'
        notes: body.notes,
      })
      .select('id')
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: `Failed to create treatment session: ${sessionError?.message}` },
        { status: 500 }
      )
    }

    // Create protocol execution records for each unique protocol
    const uniqueProtocolIds = [...new Set(body.frequencies.map(f => f.protocolRecommendationId))]

    const executionInserts = uniqueProtocolIds.map(protocolId => {
      const protocolFrequencies = body.frequencies.filter(f => f.protocolRecommendationId === protocolId)
      return {
        protocol_recommendation_id: protocolId,
        patient_id: body.patientId,
        practitioner_id: user.id,
        frequencies_used: protocolFrequencies.map(f => ({ id: f.frequencyId, name: f.frequencyName })),
        notes: body.notes,
        outcome: 'pending',
        executed_at: new Date().toISOString(),
      }
    })

    await supabase.from('protocol_executions').insert(executionInserts)

    // Update protocol recommendation statuses to 'executed'
    await supabase
      .from('protocol_recommendations')
      .update({ status: 'executed' })
      .in('id', uniqueProtocolIds)

    // Archive the diagnostic analysis
    await supabase
      .from('diagnostic_analyses')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
      })
      .eq('id', analysisId)

    // Log telemetry
    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_type: 'batch_protocols_logged',
      metadata: {
        analysis_id: analysisId,
        session_id: session.id,
        frequency_count: body.frequencies.length,
        protocol_count: uniqueProtocolIds.length,
        patient_id: body.patientId,
      },
    })

    return NextResponse.json({
      message: 'Protocols logged successfully',
      data: {
        sessionId: session.id,
        analysisId,
        frequenciesLogged: body.frequencies.length,
        protocolsUpdated: uniqueProtocolIds.length,
      },
    })

  } catch (error) {
    console.error('Batch log protocols error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
