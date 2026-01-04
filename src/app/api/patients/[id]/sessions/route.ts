import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/patients/[id]/sessions - List treatment sessions for a patient
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: patientId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a practitioner
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['practitioner', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify patient belongs to practitioner
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('user_id', user.id)
      .single()

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const effect = searchParams.get('effect')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    let query = supabase
      .from('treatment_sessions')
      .select(`
        *,
        protocols (
          id,
          title
        )
      `)
      .eq('patient_id', patientId)
      .eq('practitioner_id', user.id)
      .order('session_date', { ascending: false })
      .order('session_time', { ascending: false, nullsFirst: true })
      .limit(limit)

    if (effect && effect !== 'all') {
      query = query.eq('effect', effect)
    }

    if (startDate) {
      query = query.gte('session_date', startDate)
    }

    if (endDate) {
      query = query.lte('session_date', endDate)
    }

    const { data: sessions, error } = await query

    if (error) {
      console.error('Error fetching sessions:', error)
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
    }

    const transformed = sessions.map((s) => ({
      id: s.id,
      patientId: s.patient_id,
      practitionerId: s.practitioner_id,
      protocolId: s.protocol_id,
      protocol: s.protocols ? {
        id: s.protocols.id,
        title: s.protocols.title,
      } : null,
      sessionDate: s.session_date,
      sessionTime: s.session_time,
      frequenciesUsed: s.frequencies_used || [],
      effect: s.effect,
      notes: s.notes,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }))

    return NextResponse.json({ sessions: transformed })
  } catch (error) {
    console.error('Error in GET /api/patients/[id]/sessions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/patients/[id]/sessions - Create a new treatment session
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: patientId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a practitioner
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['practitioner', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify patient belongs to practitioner
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('user_id', user.id)
      .single()

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const body = await request.json()
    const { protocolId, sessionDate, sessionTime, frequenciesUsed, effect, notes } = body

    if (!sessionDate || !effect) {
      return NextResponse.json({ error: 'Session date and effect are required' }, { status: 400 })
    }

    if (!['positive', 'negative', 'nil'].includes(effect)) {
      return NextResponse.json({ error: 'Invalid effect value' }, { status: 400 })
    }

    // Verify protocol belongs to practitioner if provided
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

    const { data: session, error } = await supabase
      .from('treatment_sessions')
      .insert({
        patient_id: patientId,
        practitioner_id: user.id,
        protocol_id: protocolId || null,
        session_date: sessionDate,
        session_time: sessionTime || null,
        frequencies_used: frequenciesUsed || [],
        effect,
        notes: notes || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating session:', error)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
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
    }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/patients/[id]/sessions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
