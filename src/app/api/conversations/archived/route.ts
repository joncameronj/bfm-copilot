import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/conversations/archived - List archived conversations
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_archived', true)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching archived conversations:', error)
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
    }

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
    console.error('Error in GET /api/conversations/archived:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
