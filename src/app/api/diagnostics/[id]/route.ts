import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/diagnostics/[id] - Get diagnostic upload details
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('diagnostic_uploads')
      .select(`
        id,
        status,
        analysis_summary,
        patient_id,
        created_at,
        updated_at,
        diagnostic_files(
          id,
          filename,
          file_type,
          mime_type,
          size_bytes,
          storage_path,
          status
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Diagnostic upload not found' }, { status: 404 })
      }
      console.error('Error fetching diagnostic:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform data
    const upload = {
      id: data.id,
      status: data.status,
      analysisSummary: data.analysis_summary,
      patientId: data.patient_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      files: data.diagnostic_files?.map((file: {
        id: string
        filename: string
        file_type: string
        mime_type: string
        size_bytes: number
        storage_path: string
        status: string
      }) => {
        const { data: urlData } = supabase.storage
          .from('diagnostics')
          .getPublicUrl(file.storage_path)

        return {
          id: file.id,
          filename: file.filename,
          fileType: file.file_type,
          mimeType: file.mime_type,
          sizeBytes: file.size_bytes,
          status: file.status,
          url: urlData.publicUrl,
        }
      }) || [],
    }

    return NextResponse.json({ data: upload })
  } catch (error) {
    console.error('Diagnostic GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/diagnostics/[id] - Update diagnostic upload status
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { status, patientId } = body

    // Validate status if provided
    const validStatuses = ['pending', 'uploading', 'uploaded', 'processing', 'complete', 'error']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Build update object
    const updateData: Record<string, string> = {}
    if (status) updateData.status = status
    if (patientId !== undefined) updateData.patient_id = patientId

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('diagnostic_uploads')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, status, patient_id')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Diagnostic upload not found' }, { status: 404 })
      }
      console.error('Error updating diagnostic:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Diagnostic PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/diagnostics/[id] - Delete diagnostic upload
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get files to delete from storage
    const { data: files } = await supabase
      .from('diagnostic_files')
      .select('storage_path')
      .eq('upload_id', id)

    // Delete from storage
    if (files && files.length > 0) {
      const paths = files.map((f: { storage_path: string }) => f.storage_path)
      await supabase.storage.from('diagnostics').remove(paths)
    }

    // Delete upload (cascades to files)
    const { error } = await supabase
      .from('diagnostic_uploads')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting diagnostic:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Diagnostic upload deleted successfully' })
  } catch (error) {
    console.error('Diagnostic DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
