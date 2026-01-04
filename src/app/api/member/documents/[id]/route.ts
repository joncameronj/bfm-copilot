import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// DELETE /api/member/documents/[id] - Delete a document
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id: fileName } = await params
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

    // Delete file from storage (only from user's own folder)
    const filePath = `${user.id}/${fileName}`
    const { error } = await supabase.storage
      .from('member-documents')
      .remove([filePath])

    if (error) {
      console.error('Error deleting document:', error)
      return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in documents DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
