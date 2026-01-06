import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { ManualProtocolInput, TreatmentSessionResponse, FrequencyUsed } from '@/types/frequency'

export const dynamic = 'force-dynamic'

/**
 * POST /api/treatment-sessions/manual
 * Create a treatment session from manually selected approved frequencies
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a practitioner or admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['practitioner', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Only practitioners and admins can create treatment sessions' },
        { status: 403 }
      )
    }

    const body: ManualProtocolInput = await request.json()
    const { patientId, frequencyIds, sessionDate, sessionTime, effect, notes } = body

    // Validate required fields
    if (!patientId || !frequencyIds || frequencyIds.length === 0 || !sessionDate) {
      return NextResponse.json(
        { error: 'patientId, frequencyIds (non-empty), and sessionDate are required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(frequencyIds)) {
      return NextResponse.json(
        { error: 'frequencyIds must be an array' },
        { status: 400 }
      )
    }

    // Verify patient exists and belongs to practitioner
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('user_id', user.id)
      .single()

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Fetch frequency details from approved_frequency_names
    const { data: frequencies, error: frequencyError } = await supabase
      .from('approved_frequency_names')
      .select('id, name')
      .in('id', frequencyIds)
      .eq('is_active', true)

    if (frequencyError || !frequencies || frequencies.length === 0) {
      return NextResponse.json(
        { error: 'One or more frequencies not found or inactive' },
        { status: 404 }
      )
    }

    // Verify all requested frequencies were found
    if (frequencies.length !== frequencyIds.length) {
      return NextResponse.json(
        { error: 'One or more frequencies not found or inactive' },
        { status: 404 }
      )
    }

    // Transform frequencies to FrequencyUsed format
    const frequenciesUsed: FrequencyUsed[] = frequencies.map((f) => ({
      id: f.id,
      name: f.name,
    }))

    // Create treatment session
    const { data: session, error: sessionError } = await supabase
      .from('treatment_sessions')
      .insert({
        patient_id: patientId,
        practitioner_id: user.id,
        session_date: sessionDate,
        session_time: sessionTime || null,
        frequencies_used: frequenciesUsed,
        effect: effect || null,
        notes: notes || null,
      })
      .select()
      .single()

    if (sessionError || !session) {
      console.error('Error creating treatment session:', sessionError)
      return NextResponse.json(
        { error: 'Failed to create treatment session' },
        { status: 500 }
      )
    }

    // Log usage event
    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_type: 'manual_protocol_created',
      metadata: {
        session_id: session.id,
        patient_id: patientId,
        frequency_count: frequenciesUsed.length,
      },
    })

    const response: TreatmentSessionResponse = {
      id: session.id,
      patientId: session.patient_id,
      practitionerId: session.practitioner_id,
      sessionDate: session.session_date,
      sessionTime: session.session_time,
      frequenciesUsed: session.frequencies_used || [],
      effect: session.effect,
      notes: session.notes,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
    }

    return NextResponse.json({ session: response }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/treatment-sessions/manual:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
