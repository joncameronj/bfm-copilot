import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/patients/[id]/conversations - Get patient's conversations
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

    // Get conversations for this patient
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id,
        title,
        conversation_type,
        message_count,
        created_at,
        updated_at
      `)
      .eq('patient_id', patientId)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching conversations:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Patient conversations GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
