import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// POST /api/diagnostics/upload - Upload a diagnostic file
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string
    const patientId = formData.get('patientId') as string | null
    const uploadId = formData.get('uploadId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Create or use existing upload session
    let diagnosticUploadId = uploadId

    if (!diagnosticUploadId) {
      const { data: uploadData, error: uploadError } = await supabase
        .from('diagnostic_uploads')
        .insert({
          user_id: user.id,
          patient_id: patientId || null,
          status: 'uploading',
        })
        .select('id')
        .single()

      if (uploadError) {
        console.error('Error creating upload session:', uploadError)
        return NextResponse.json({ error: uploadError.message }, { status: 500 })
      }

      diagnosticUploadId = uploadData.id
    }

    // Upload file to Supabase Storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/${diagnosticUploadId}/${crypto.randomUUID()}.${fileExt}`

    const { data: storageData, error: storageError } = await supabase.storage
      .from('diagnostics')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      })

    if (storageError) {
      console.error('Storage upload error:', storageError)
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
    }

    // Valid database enum values for diagnostic_type
    const validFileTypes = ['d_pulse', 'hrv', 'nes_scan', 'mold_toxicity', 'blood_panel', 'other']
    const safeFileType = validFileTypes.includes(type) ? type : 'other'

    // Create diagnostic file record
    const { data: fileData, error: fileError } = await supabase
      .from('diagnostic_files')
      .insert({
        upload_id: diagnosticUploadId,
        filename: file.name,
        file_type: safeFileType,
        mime_type: file.type,
        size_bytes: file.size,
        storage_path: storageData.path,
        status: 'uploaded',
      })
      .select()
      .single()

    if (fileError) {
      console.error('Error creating file record:', fileError)
      return NextResponse.json({ error: fileError.message }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('diagnostics')
      .getPublicUrl(storageData.path)

    // Track usage event
    try {
      await supabase.from('usage_events').insert({
        user_id: user.id,
        event_type: 'diagnostic_uploaded',
        metadata: {
          file_type: type,
          upload_id: diagnosticUploadId,
          file_id: fileData.id,
        },
      })
    } catch {
      // Silently fail - tracking shouldn't break the app
    }

    return NextResponse.json({
      data: {
        id: fileData.id,
        uploadId: diagnosticUploadId,
        filename: file.name,
        fileType: type,
        url: urlData.publicUrl,
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Diagnostics upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
