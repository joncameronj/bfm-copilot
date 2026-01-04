import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// GET /api/diagnostics - List diagnostic uploads
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patientId')

    let query = supabase
      .from('diagnostic_uploads')
      .select(`
        id,
        status,
        analysis_summary,
        created_at,
        updated_at,
        patient_id,
        diagnostic_files(
          id,
          filename,
          file_type,
          mime_type,
          size_bytes,
          status
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (patientId) {
      query = query.eq('patient_id', patientId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching diagnostics:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform data
    const allUploads = data?.map((upload) => ({
      id: upload.id,
      status: upload.status,
      analysisSummary: upload.analysis_summary,
      patientId: upload.patient_id,
      createdAt: upload.created_at,
      updatedAt: upload.updated_at,
      files: upload.diagnostic_files?.map((file: {
        id: string
        filename: string
        file_type: string
        mime_type: string
        size_bytes: number
        status: string
      }) => ({
        id: file.id,
        filename: file.filename,
        fileType: file.file_type,
        mimeType: file.mime_type,
        sizeBytes: file.size_bytes,
        status: file.status,
      })) || [],
    })) || []

    // Filter out empty uploads (0 files)
    const uploads = allUploads.filter(upload => upload.files.length > 0)

    return NextResponse.json({ data: uploads })
  } catch (error) {
    console.error('Diagnostics GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/diagnostics - Create diagnostic upload session
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { patientId } = body

    const { data, error } = await supabase
      .from('diagnostic_uploads')
      .insert({
        user_id: user.id,
        patient_id: patientId || null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating diagnostic upload:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('Diagnostics POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
