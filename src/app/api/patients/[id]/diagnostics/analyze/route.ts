import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

interface AnalyzeBody {
  uploadId?: string
  diagnosticUploadId?: string
}

// Legacy compatibility endpoint from earlier specs:
// POST /api/patients/{id}/diagnostics/analyze
// Redirects to /api/diagnostics/{uploadId}/generate-analysis
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: patientId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify patient belongs to current user
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Optional explicit upload ID in request body
    let body: AnalyzeBody = {}
    try {
      body = (await request.json()) as AnalyzeBody
    } catch {
      // No JSON body provided; fallback to latest upload
    }

    const explicitUploadId =
      typeof body.diagnosticUploadId === 'string' && body.diagnosticUploadId.trim()
        ? body.diagnosticUploadId.trim()
        : typeof body.uploadId === 'string' && body.uploadId.trim()
          ? body.uploadId.trim()
          : null

    let uploadId: string | null = explicitUploadId

    if (uploadId) {
      const { data: explicitUpload } = await supabase
        .from('diagnostic_uploads')
        .select('id')
        .eq('id', uploadId)
        .eq('patient_id', patientId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!explicitUpload) {
        return NextResponse.json(
          { error: 'Diagnostic upload not found for this patient' },
          { status: 404 }
        )
      }
    } else {
      // Prefer uploads that are ready to analyze.
      const { data: latestReadyUpload } = await supabase
        .from('diagnostic_uploads')
        .select('id')
        .eq('patient_id', patientId)
        .eq('user_id', user.id)
        .eq('status', 'uploaded')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestReadyUpload?.id) {
        uploadId = latestReadyUpload.id
      } else {
        // Fallback to most recent upload if none are currently "uploaded".
        const { data: latestUpload } = await supabase
          .from('diagnostic_uploads')
          .select('id')
          .eq('patient_id', patientId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        uploadId = latestUpload?.id || null
      }
    }

    if (!uploadId) {
      return NextResponse.json(
        { error: 'No diagnostic uploads found for this patient' },
        { status: 404 }
      )
    }

    const target = new URL(`/api/diagnostics/${uploadId}/generate-analysis`, request.url)
    return NextResponse.redirect(target, 307)
  } catch (error) {
    console.error('Patient diagnostics analyze compatibility route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
