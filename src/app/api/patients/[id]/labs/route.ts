import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/patients/[id]/labs - Get patient's lab results
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

    // Get lab results
    const { data, error } = await supabase
      .from('lab_results')
      .select(`
        id,
        test_date,
        ominous_count,
        ominous_markers_triggered,
        notes,
        created_at,
        updated_at,
        lab_values:lab_values(
          id,
          marker_id,
          value,
          evaluation,
          delta_from_target,
          weakness_text,
          is_ominous
        )
      `)
      .eq('patient_id', patientId)
      .order('test_date', { ascending: false })

    if (error) {
      console.error('Error fetching labs:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Patient labs GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
