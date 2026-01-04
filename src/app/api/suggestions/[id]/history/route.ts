import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

interface SuggestionWithHistory {
  id: string
  user_id: string
  conversation_id: string | null
  content: string
  category: string
  status: string
  source_context: Record<string, unknown>
  iteration_count: number
  parent_suggestion_id: string | null
  created_at: string
  updated_at: string
  suggestion_feedback: Array<{
    id: string
    rating: string
    feedback_text: string | null
    outcome: string | null
    created_at: string
  }>
}

// GET /api/suggestions/[id]/history - Get iteration history for a suggestion
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: suggestionId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = user.id

    // First get the current suggestion
    const { data: currentSuggestion, error: currentError } = await supabase
      .from('suggestions')
      .select('id, parent_suggestion_id, user_id')
      .eq('id', suggestionId)
      .eq('user_id', userId)
      .single()

    if (currentError || !currentSuggestion) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
    }

    // Find the root suggestion (one with no parent)
    let rootId = suggestionId
    let currentParent = currentSuggestion.parent_suggestion_id

    while (currentParent) {
      const { data: parent } = await supabase
        .from('suggestions')
        .select('id, parent_suggestion_id')
        .eq('id', currentParent)
        .single()

      if (parent) {
        rootId = parent.id
        currentParent = parent.parent_suggestion_id
      } else {
        break
      }
    }

    // Now get all suggestions in this chain (root + all children)
    const history: SuggestionWithHistory[] = []

    // Recursive function to build the chain
    async function buildChain(startId: string) {
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
        .eq('id', startId)
        .eq('user_id', userId)
        .single()

      if (error || !suggestion) return

      history.push(suggestion as SuggestionWithHistory)

      // Find children (suggestions that have this as parent)
      const { data: children } = await supabase
        .from('suggestions')
        .select('id')
        .eq('parent_suggestion_id', startId)
        .eq('user_id', userId)

      if (children) {
        for (const child of children) {
          await buildChain(child.id)
        }
      }
    }

    await buildChain(rootId)

    // Sort by iteration count
    history.sort((a, b) => a.iteration_count - b.iteration_count)

    const transformed = history.map((s) => ({
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
      feedback: s.suggestion_feedback?.map((f) => ({
        id: f.id,
        rating: f.rating,
        feedbackText: f.feedback_text,
        outcome: f.outcome,
        createdAt: f.created_at,
      })) || [],
    }))

    return NextResponse.json({
      history: transformed,
      currentId: suggestionId,
      rootId,
      totalIterations: history.length,
    })
  } catch (error) {
    console.error('Error in GET /api/suggestions/[id]/history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
