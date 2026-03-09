import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const CHAT_UPLOAD_BUCKET = 'diagnostics'
const CHAT_UPLOAD_PREFIX = 'chat'

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_')
}

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
    const conversationId = formData.get('conversationId') as string | null

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
      'image/webp',
    ]

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `File type ${file.type} is not allowed` },
          { status: 400 }
        )
      }
    }

    const safeConversationFolder = conversationId || 'adhoc'
    const uploadedPaths: string[] = []
    const uploadedFiles: Array<{
      id: string
      filename: string
      size: number
      type: string
    }> = []

    for (const file of files) {
      const sanitizedName = sanitizeFilename(file.name)
      const storagePath =
        `${user.id}/${CHAT_UPLOAD_PREFIX}/${safeConversationFolder}/` +
        `${Date.now()}-${crypto.randomUUID()}-${sanitizedName}`

      const { data: storageData, error: storageError } = await supabase.storage
        .from(CHAT_UPLOAD_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        })

      if (storageError || !storageData?.path) {
        if (uploadedPaths.length > 0) {
          await supabase.storage.from(CHAT_UPLOAD_BUCKET).remove(uploadedPaths)
        }
        console.error('Chat file upload failed:', storageError)
        return NextResponse.json(
          { error: `Failed to upload ${file.name}` },
          { status: 500 }
        )
      }

      uploadedPaths.push(storageData.path)
      uploadedFiles.push({
        id: `storage:${storageData.path}`,
        filename: file.name,
        size: file.size,
        type: file.type,
      })
    }

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
