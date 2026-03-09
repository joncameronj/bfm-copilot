import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// GET /api/conversations - List conversations
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      console.error('Auth error in GET /api/conversations:', authError)
    }

    if (!user) {
      console.error('No user found in GET /api/conversations')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const patientId = searchParams.get('patientId')
    const includeArchived = searchParams.get('includeArchived') === 'true'

    let query = supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (patientId) {
      query = query.eq('patient_id', patientId)
    }

    // Filter out archived conversations by default
    if (!includeArchived) {
      query = query.eq('is_archived', false)
    }

    const { data: conversations, error } = await query

    if (error) {
      console.error('Error fetching conversations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: 500 }
      )
    }

    // Transform snake_case to camelCase
    const transformedConversations = conversations.map((conv) => ({
      id: conv.id,
      userId: conv.user_id,
      patientId: conv.patient_id,
      title: conv.title,
      threadId: conv.thread_id,
      conversationType: conv.conversation_type,
      messageCount: conv.message_count,
      isStarred: conv.is_starred ?? false,
      isArchived: conv.is_archived ?? false,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
    }))

    return NextResponse.json({ conversations: transformedConversations })
  } catch (error) {
    console.error('Error in GET /api/conversations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/conversations - Create a new conversation
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, patientId, conversationType } = body

    // Create conversation in database
    const { data: conversation, error } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        patient_id: patientId || null,
        title: title || 'New Conversation',
        thread_id: null,
        conversation_type: conversationType || 'general',
        message_count: 0,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating conversation:', error)
      return NextResponse.json(
        { error: 'Failed to create conversation' },
        { status: 500 }
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
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
    }

    return NextResponse.json({
      conversation: transformedConversation,
    })
  } catch (error) {
    console.error('Error in POST /api/conversations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
