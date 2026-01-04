import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/conversations/[id] - Get a conversation
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Transform to camelCase
    const transformedConversation = {
      id: conversation.id,
      userId: conversation.user_id,
      patientId: conversation.patient_id,
      title: conversation.title,
      threadId: conversation.thread_id,
      conversationType: conversation.conversation_type,
      messageCount: conversation.message_count,
      isStarred: conversation.is_starred ?? false,
      isArchived: conversation.is_archived ?? false,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
    }

    return NextResponse.json({ conversation: transformedConversation })
  } catch (error) {
    console.error('Error in GET /api/conversations/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/conversations/[id] - Update a conversation
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, patientId, conversationType, isStarred, isArchived } = body

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (title !== undefined) updates.title = title
    if (patientId !== undefined) updates.patient_id = patientId
    if (conversationType !== undefined)
      updates.conversation_type = conversationType
    if (isStarred !== undefined) updates.is_starred = isStarred
    if (isArchived !== undefined) updates.is_archived = isArchived

    const { data: conversation, error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Transform to camelCase
    const transformedConversation = {
      id: conversation.id,
      userId: conversation.user_id,
      patientId: conversation.patient_id,
      title: conversation.title,
      threadId: conversation.thread_id,
      conversationType: conversation.conversation_type,
      messageCount: conversation.message_count,
      isStarred: conversation.is_starred ?? false,
      isArchived: conversation.is_archived ?? false,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
    }

    return NextResponse.json({ conversation: transformedConversation })
  } catch (error) {
    console.error('Error in PUT /api/conversations/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/conversations/[id] - Delete a conversation
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting conversation:', error)
      return NextResponse.json(
        { error: 'Failed to delete conversation' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/conversations/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
