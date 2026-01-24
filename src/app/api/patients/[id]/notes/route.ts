import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/patients/[id]/notes - Get patient's notes
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: patientId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify patient belongs to user
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('user_id', user.id)
      .single()

    if (patientError || !patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Get patient notes
    const { data, error } = await supabase
      .from('patient_notes')
      .select('id, content, created_at, updated_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching notes:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Patient notes GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/patients/[id]/notes - Create a new note
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: patientId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify patient belongs to user
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('user_id', user.id)
      .single()

    if (patientError || !patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const body = await request.json()
    const { content } = body

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Note content is required' }, { status: 400 })
    }

    // Create the note
    const { data, error } = await supabase
      .from('patient_notes')
      .insert({
        patient_id: patientId,
        user_id: user.id,
        content: content.trim()
      })
      .select('id, content, created_at, updated_at')
      .single()

    if (error) {
      console.error('Error creating note:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('Patient notes POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
