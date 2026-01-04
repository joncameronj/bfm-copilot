import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/suggestions/[id] - Get single suggestion with feedback history
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: suggestion, error } = await supabase
      .from('suggestions')
      .select(`
        *,
        suggestion_feedback (
          id,
          rating,
          feedback_text,
          outcome,
          created_at
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !suggestion) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
    }

    return NextResponse.json({
      suggestion: {
        id: suggestion.id,
        userId: suggestion.user_id,
        conversationId: suggestion.conversation_id,
        content: suggestion.content,
        category: suggestion.category,
        status: suggestion.status,
        sourceContext: suggestion.source_context,
        iterationCount: suggestion.iteration_count,
        parentSuggestionId: suggestion.parent_suggestion_id,
        createdAt: suggestion.created_at,
        updatedAt: suggestion.updated_at,
        feedback: suggestion.suggestion_feedback?.map((f: Record<string, unknown>) => ({
          id: f.id,
          rating: f.rating,
          feedbackText: f.feedback_text,
          outcome: f.outcome,
          createdAt: f.created_at,
        })) || [],
      }
    })
  } catch (error) {
    console.error('Error in GET /api/suggestions/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/suggestions/[id] - Update suggestion status
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { status } = body

    const validStatuses = ['pending', 'accepted', 'rejected', 'superseded']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { data: suggestion, error } = await supabase
      .from('suggestions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error || !suggestion) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
    }

    return NextResponse.json({
      suggestion: {
        id: suggestion.id,
        userId: suggestion.user_id,
        conversationId: suggestion.conversation_id,
        content: suggestion.content,
        category: suggestion.category,
        status: suggestion.status,
        sourceContext: suggestion.source_context,
        iterationCount: suggestion.iteration_count,
        parentSuggestionId: suggestion.parent_suggestion_id,
        createdAt: suggestion.created_at,
        updatedAt: suggestion.updated_at,
      }
    })
  } catch (error) {
    console.error('Error in PUT /api/suggestions/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/suggestions/[id]
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('suggestions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting suggestion:', error)
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/suggestions/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
