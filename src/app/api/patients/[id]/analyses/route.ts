import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/patients/[id]/analyses
// Get all diagnostic analyses for a patient with recommendations and executions
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

    // Get analyses with nested recommendations and executions
    const { data: analyses, error: analysesError } = await supabase
      .from('diagnostic_analyses')
      .select(`
        id,
        diagnostic_upload_id,
        summary,
        status,
        error_message,
        created_at,
        updated_at,
        diagnostic_uploads (
          id,
          status,
          diagnostic_files (
            id,
            filename,
            file_type
          )
        ),
        protocol_recommendations (
          id,
          title,
          description,
          category,
          recommended_frequencies,
          supplementation,
          priority,
          status,
          created_at,
          protocol_executions (
            id,
            executed_at,
            frequencies_used,
            duration_minutes,
            notes,
            outcome,
            outcome_notes,
            outcome_recorded_at
          )
        )
      `)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })

    if (analysesError) {
      return NextResponse.json(
        { error: `Failed to fetch analyses: ${analysesError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: analyses || [],
    })

  } catch (error) {
    console.error('Get patient analyses error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
