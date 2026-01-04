import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/suggestions - List suggestions for member
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a member
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'member') {
      return NextResponse.json({ error: 'Suggestions are only available to members' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    let query = supabase
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
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data: suggestions, error } = await query

    if (error) {
      console.error('Error fetching suggestions:', error)
      return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 })
    }

    const transformed = suggestions.map((s) => ({
      id: s.id,
      userId: s.user_id,
      conversationId: s.conversation_id,
      content: s.content,
      category: s.category,
      status: s.status,
      sourceContext: s.source_context,
      iterationCount: s.iteration_count,
      parentSuggestionId: s.parent_suggestion_id,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      feedback: s.suggestion_feedback?.map((f: Record<string, unknown>) => ({
        id: f.id,
        rating: f.rating,
        feedbackText: f.feedback_text,
        outcome: f.outcome,
        createdAt: f.created_at,
      })) || [],
    }))

    return NextResponse.json({ suggestions: transformed })
  } catch (error) {
    console.error('Error in GET /api/suggestions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/suggestions - Create suggestion (typically called by AI)
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { conversationId, content, category, sourceContext, parentSuggestionId } = body

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Calculate iteration count if this is an iteration
    let iterationCount = 1
    if (parentSuggestionId) {
      const { data: parent } = await supabase
        .from('suggestions')
        .select('iteration_count')
        .eq('id', parentSuggestionId)
        .single()

      if (parent) {
        iterationCount = (parent.iteration_count || 1) + 1

        // Mark parent as superseded
        await supabase
          .from('suggestions')
          .update({ status: 'superseded', updated_at: new Date().toISOString() })
          .eq('id', parentSuggestionId)
      }
    }

    const { data: suggestion, error } = await supabase
      .from('suggestions')
      .insert({
        user_id: user.id,
        conversation_id: conversationId || null,
        content,
        category: category || 'general',
        status: 'pending',
        source_context: sourceContext || {},
        iteration_count: iterationCount,
        parent_suggestion_id: parentSuggestionId || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating suggestion:', error)
      return NextResponse.json({ error: 'Failed to create suggestion' }, { status: 500 })
    }

    // Track usage event
    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_type: 'suggestion_generated',
      metadata: { suggestion_id: suggestion.id, category: suggestion.category },
    })

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
    }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/suggestions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
