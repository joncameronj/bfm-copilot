import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/patients/[id]/diagnostic-summary - Get diagnostic summary for a patient
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

    // Get all diagnostic uploads for this patient with their files
    const { data: uploads, error: uploadsError } = await supabase
      .from('diagnostic_uploads')
      .select(`
        id,
        status,
        diagnostic_files(
          id,
          file_type,
          status
        )
      `)
      .eq('patient_id', patientId)
      .eq('user_id', user.id)

    if (uploadsError) {
      console.error('Error fetching diagnostic uploads:', uploadsError)
      return NextResponse.json({ error: uploadsError.message }, { status: 500 })
    }

    // Check if patient has any analyses
    const { data: analyses, error: analysesError } = await supabase
      .from('diagnostic_analyses')
      .select('id')
      .eq('patient_id', patientId)
      .eq('practitioner_id', user.id)
      .limit(1)

    if (analysesError) {
      console.error('Error fetching diagnostic analyses:', analysesError)
      return NextResponse.json({ error: analysesError.message }, { status: 500 })
    }

    // Extract unique diagnostic types from all files
    const diagnosticTypes = new Set<string>()
    let totalUploads = 0
    let pendingUploads = 0

    uploads?.forEach(upload => {
      // Only count uploads with files
      const files = upload.diagnostic_files as Array<{ id: string; file_type: string; status: string }> | null
      if (files && files.length > 0) {
        totalUploads++

        // Count pending uploads (uploaded but not analyzed)
        if (upload.status === 'uploaded') {
          pendingUploads++
        }

        // Collect diagnostic types
        files.forEach(file => {
          if (file.file_type) {
            diagnosticTypes.add(file.file_type)
          }
        })
      }
    })

    const summary = {
      patientId,
      diagnosticTypes: Array.from(diagnosticTypes),
      hasAnalysis: (analyses?.length ?? 0) > 0,
      pendingUploads,
      totalUploads,
    }

    return NextResponse.json({ data: summary })
  } catch (error) {
    console.error('Diagnostic summary GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
