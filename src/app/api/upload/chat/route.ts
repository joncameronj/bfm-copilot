import { createClient } from '@/lib/supabase/server'
import { uploadFile } from '@/lib/openai'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// POST /api/upload/chat - Upload files for chat
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    // Limit to 5 files
    if (files.length > 5) {
      return NextResponse.json(
        { error: 'Maximum 5 files allowed' },
        { status: 400 }
      )
    }

    // Maximum file size: 10MB
    const maxSize = 10 * 1024 * 1024
    for (const file of files) {
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds 10MB limit` },
          { status: 400 }
        )
      }
    }

    // Allowed file types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/jpg',
    ]

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `File type ${file.type} is not allowed` },
          { status: 400 }
        )
      }
    }

    // Upload files to OpenAI
    const uploadedFiles = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer())
        const uploaded = await uploadFile(buffer, file.name, 'assistants')
        return {
          id: uploaded.id,
          filename: file.name,
          size: file.size,
          type: file.type,
        }
      })
    )

    return NextResponse.json({
      fileIds: uploadedFiles.map((f) => f.id),
      files: uploadedFiles,
    })
  } catch (error) {
    console.error('Error in POST /api/upload/chat:', error)
    return NextResponse.json(
      { error: 'Failed to upload files' },
      { status: 500 }
    )
  }
}
