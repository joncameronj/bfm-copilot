import { createClient } from '@/lib/supabase/server'
import { createThread } from '@/lib/openai'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// POST /api/assistants/threads - Create a new OpenAI thread
export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const thread = await createThread()

    return NextResponse.json({
      threadId: thread.id,
      createdAt: thread.created_at,
    })
  } catch (error) {
    console.error('Error in POST /api/assistants/threads:', error)
    return NextResponse.json(
      { error: 'Failed to create thread' },
      { status: 500 }
    )
  }
}
