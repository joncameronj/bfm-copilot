import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/member/documents - Get member's uploaded documents
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify member role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'member') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // List files from storage
    const { data: files, error } = await supabase.storage
      .from('member-documents')
      .list(`${user.id}/`, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      })

    if (error) {
      console.error('Error listing documents:', error)
      return NextResponse.json({ error: 'Failed to list documents' }, { status: 500 })
    }

    const documents = (files || []).map((file) => ({
      id: file.id,
      name: file.name,
      type: file.metadata?.mimetype || 'application/octet-stream',
      size: file.metadata?.size || 0,
      created_at: file.created_at,
    }))

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('Error in documents GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/member/documents - Upload a new document
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify member role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'member') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    const fileName = `${Date.now()}-${file.name}`
    const filePath = `${user.id}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('member-documents')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Error uploading document:', uploadError)
      return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      document: {
        name: file.name,
        path: filePath,
        type: file.type,
        size: file.size,
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error in documents POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
