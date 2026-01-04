import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/protocols - List protocols for practitioner
export async function GET(request: Request) {
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
      return NextResponse.json({ error: 'Protocols are only available to practitioners' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const patientId = searchParams.get('patientId')
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    let query = supabase
      .from('protocols')
      .select(`
        *,
        patients (
          id,
          first_name,
          last_name
        ),
        protocol_feedback (
          id,
          outcome,
          outcome_text,
          rating,
          created_at
        )
      `)
      .eq('practitioner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    if (patientId) {
      query = query.eq('patient_id', patientId)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data: protocols, error } = await query

    if (error) {
      console.error('Error fetching protocols:', error)
      return NextResponse.json({ error: 'Failed to fetch protocols' }, { status: 500 })
    }

    const transformed = protocols.map((p) => ({
      id: p.id,
      practitionerId: p.practitioner_id,
      patientId: p.patient_id,
      patient: p.patients ? {
        id: p.patients.id,
        firstName: p.patients.first_name,
        lastName: p.patients.last_name,
      } : null,
      title: p.title,
      content: p.content,
      category: p.category,
      status: p.status,
      durationDays: p.duration_days,
      startDate: p.start_date,
      endDate: p.end_date,
      notes: p.notes,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      feedback: p.protocol_feedback?.map((f: Record<string, unknown>) => ({
        id: f.id,
        outcome: f.outcome,
        outcomeText: f.outcome_text,
        rating: f.rating,
        createdAt: f.created_at,
      })) || [],
    }))

    return NextResponse.json({ protocols: transformed })
  } catch (error) {
    console.error('Error in GET /api/protocols:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/protocols - Create protocol
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
      return NextResponse.json({ error: 'Only practitioners can create protocols' }, { status: 403 })
    }

    const body = await request.json()
    const { patientId, title, content, category, durationDays, startDate, endDate, notes } = body

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
    }

    // Verify patient exists and belongs to practitioner (if provided)
    if (patientId) {
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .select('id')
        .eq('id', patientId)
        .eq('user_id', user.id)
        .single()

      if (patientError || !patient) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
      }
    }

    const { data: protocol, error } = await supabase
      .from('protocols')
      .insert({
        practitioner_id: user.id,
        patient_id: patientId || null,
        title,
        content,
        category: category || 'general',
        status: 'draft',
        duration_days: durationDays || null,
        start_date: startDate || null,
        end_date: endDate || null,
        notes: notes || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating protocol:', error)
      return NextResponse.json({ error: 'Failed to create protocol' }, { status: 500 })
    }

    // Track usage event
    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_type: 'protocol_generated',
      metadata: { protocol_id: protocol.id, patient_id: patientId, category: protocol.category },
    })

    return NextResponse.json({
      protocol: {
        id: protocol.id,
        practitionerId: protocol.practitioner_id,
        patientId: protocol.patient_id,
        title: protocol.title,
        content: protocol.content,
        category: protocol.category,
        status: protocol.status,
        durationDays: protocol.duration_days,
        startDate: protocol.start_date,
        endDate: protocol.end_date,
        notes: protocol.notes,
        createdAt: protocol.created_at,
        updatedAt: protocol.updated_at,
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/protocols:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
