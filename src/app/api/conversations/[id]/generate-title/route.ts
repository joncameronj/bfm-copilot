import { createClient } from '@/lib/supabase/server'
import { getAnthropicClient } from '@/lib/anthropic'
import { NextResponse } from 'next/server'
import { getDefaultFastModel } from '@/lib/ai/provider'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/conversations/[id]/generate-title - Generate an AI title for the conversation
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

    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, title')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Get the first few messages from the conversation
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .limit(4)

    if (msgError || !messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages found to generate title from' },
        { status: 400 }
      )
    }

    // Build conversation context for title generation
    const conversationText = messages
      .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
      .join('\n')

    // Generate title using the configured Anthropic model
    const client = getAnthropicClient()
    const completion = await client.messages.create({
      model: getDefaultFastModel(),
      max_tokens: 30,
      temperature: 0.7,
      system: 'You are a title generator. Generate a concise, descriptive title (3-6 words) for the following conversation. The title should capture the main topic or intent. Return only the title text, nothing else.',
      messages: [
        {
          role: 'user',
          content: conversationText,
        },
      ],
    })

    const textBlock = completion.content.find((b) => b.type === 'text')
    const generatedTitle =
      (textBlock && 'text' in textBlock ? textBlock.text.trim() : null) || 'New Conversation'

    // Update the conversation title
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        title: generatedTitle,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error updating conversation title:', updateError)
      return NextResponse.json(
        { error: 'Failed to update title' },
        { status: 500 }
      )
    }

    return NextResponse.json({ title: generatedTitle })
  } catch (error) {
    console.error('Error in POST /api/conversations/[id]/generate-title:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
