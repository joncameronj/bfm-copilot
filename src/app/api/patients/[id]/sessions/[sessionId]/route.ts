import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string; sessionId: string }>
}

// GET /api/patients/[id]/sessions/[sessionId] - Get a single treatment session
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: patientId, sessionId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: session, error } = await supabase
      .from('treatment_sessions')
      .select(`
        *,
        protocols (
          id,
          title,
          category,
          status
        )
      `)
      .eq('id', sessionId)
      .eq('patient_id', patientId)
      .eq('practitioner_id', user.id)
      .single()

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    return NextResponse.json({
      session: {
        id: session.id,
        patientId: session.patient_id,
        practitionerId: session.practitioner_id,
        protocolId: session.protocol_id,
        protocol: session.protocols ? {
          id: session.protocols.id,
          title: session.protocols.title,
          category: session.protocols.category,
          status: session.protocols.status,
        } : null,
        sessionDate: session.session_date,
        sessionTime: session.session_time,
        frequenciesUsed: session.frequencies_used || [],
        effect: session.effect,
        notes: session.notes,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      }
    })
  } catch (error) {
    console.error('Error in GET /api/patients/[id]/sessions/[sessionId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/patients/[id]/sessions/[sessionId] - Update a treatment session
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id: patientId, sessionId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify session exists and belongs to practitioner
    const { data: existingSession } = await supabase
      .from('treatment_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('patient_id', patientId)
      .eq('practitioner_id', user.id)
      .single()

    if (!existingSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const body = await request.json()
    const { protocolId, sessionDate, sessionTime, frequenciesUsed, effect, notes } = body

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {}

    if (protocolId !== undefined) {
      // Verify protocol if provided
      if (protocolId) {
        const { data: protocol } = await supabase
          .from('protocols')
          .select('id')
          .eq('id', protocolId)
          .eq('practitioner_id', user.id)
          .single()

        if (!protocol) {
          return NextResponse.json({ error: 'Protocol not found' }, { status: 404 })
        }
      }
      updateData.protocol_id = protocolId || null
    }

    if (sessionDate !== undefined) {
      updateData.session_date = sessionDate
    }

    if (sessionTime !== undefined) {
      updateData.session_time = sessionTime || null
    }

    if (frequenciesUsed !== undefined) {
      updateData.frequencies_used = frequenciesUsed
    }

    if (effect !== undefined) {
      if (!['positive', 'negative', 'nil'].includes(effect)) {
        return NextResponse.json({ error: 'Invalid effect value' }, { status: 400 })
      }
      updateData.effect = effect
    }

    if (notes !== undefined) {
      updateData.notes = notes || null
    }

    const { data: session, error } = await supabase
      .from('treatment_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select()
      .single()

    if (error) {
      console.error('Error updating session:', error)
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
    }

    return NextResponse.json({
      session: {
        id: session.id,
        patientId: session.patient_id,
        practitionerId: session.practitioner_id,
        protocolId: session.protocol_id,
        sessionDate: session.session_date,
        sessionTime: session.session_time,
        frequenciesUsed: session.frequencies_used,
        effect: session.effect,
        notes: session.notes,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      }
    })
  } catch (error) {
    console.error('Error in PUT /api/patients/[id]/sessions/[sessionId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/patients/[id]/sessions/[sessionId] - Delete a treatment session
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id: patientId, sessionId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('treatment_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('patient_id', patientId)
      .eq('practitioner_id', user.id)

    if (error) {
      console.error('Error deleting session:', error)
      return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/patients/[id]/sessions/[sessionId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
