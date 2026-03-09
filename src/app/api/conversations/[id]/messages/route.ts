import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/conversations/[id]/messages - Get messages for a conversation
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

    // First verify the conversation belongs to the user
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('thread_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Get messages
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching messages:', error)
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      )
    }

    // Transform to camelCase
    const transformedMessages = (messages || []).map((msg) => ({
      id: msg.id,
      conversationId: msg.conversation_id,
      role: msg.role,
      content: msg.content,
      metadata: msg.metadata,
      createdAt: msg.created_at,
    }))

    return NextResponse.json({
      messages: transformedMessages,
      threadId: conversation.thread_id,
    })
  } catch (error) {
    console.error('Error in GET /api/conversations/[id]/messages:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/conversations/[id]/messages - Add a message to a conversation
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the conversation belongs to the user
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, message_count')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { id: clientMessageId, role, content, metadata } = body

    if (!role || !content) {
      return NextResponse.json(
        { error: 'Role and content are required' },
        { status: 400 }
      )
    }

    // If client provides a message ID (optimistic UI), preserve it so downstream
    // references (feedback/evaluations) use a stable FK-valid ID.
    if (clientMessageId && typeof clientMessageId !== 'string') {
      return NextResponse.json(
        { error: 'Message id must be a string UUID when provided' },
        { status: 400 }
      )
    }

    // Insert message
    const insertPayload: {
      id?: string
      conversation_id: string
      role: string
      content: string
      metadata: Record<string, unknown>
    } = {
      conversation_id: id,
      role,
      content,
      metadata: metadata || {},
    }

    if (clientMessageId) {
      insertPayload.id = clientMessageId
    }

    const { data: message, error } = await supabase
      .from('messages')
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      console.error('Error creating message:', error)
      return NextResponse.json(
        { error: 'Failed to create message' },
        { status: 500 }
      )
    }

    // Update conversation message count
    await supabase
      .from('conversations')
      .update({
        message_count: (conversation.message_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    // Transform to camelCase
    const transformedMessage = {
      id: message.id,
      conversationId: message.conversation_id,
      role: message.role,
      content: message.content,
      metadata: message.metadata,
      createdAt: message.created_at,
    }

    return NextResponse.json({ message: transformedMessage })
  } catch (error) {
    console.error('Error in POST /api/conversations/[id]/messages:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
