import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/suggestions/[id]/feedback - Submit feedback on suggestion
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: suggestionId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { rating, feedbackText, outcome } = body

    if (!rating || !['thumbs_up', 'thumbs_down'].includes(rating)) {
      return NextResponse.json({ error: 'Invalid rating. Must be thumbs_up or thumbs_down' }, { status: 400 })
    }

    const validOutcomes = ['helped', 'no_change', 'made_worse', 'too_difficult']
    if (outcome && !validOutcomes.includes(outcome)) {
      return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 })
    }

    // Verify suggestion exists and belongs to user
    const { data: suggestion, error: suggestionError } = await supabase
      .from('suggestions')
      .select('id, user_id')
      .eq('id', suggestionId)
      .eq('user_id', user.id)
      .single()

    if (suggestionError || !suggestion) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
    }

    // Create feedback
    const { data: feedback, error } = await supabase
      .from('suggestion_feedback')
      .insert({
        suggestion_id: suggestionId,
        rating,
        feedback_text: feedbackText || null,
        outcome: outcome || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating feedback:', error)
      return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 })
    }

    // Update suggestion status based on feedback
    const newStatus = rating === 'thumbs_up' ? 'accepted' : 'rejected'
    await supabase
      .from('suggestions')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', suggestionId)

    // Track usage event
    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_type: 'suggestion_feedback_submitted',
      metadata: { suggestion_id: suggestionId, rating, outcome },
    })

    return NextResponse.json({
      feedback: {
        id: feedback.id,
        suggestionId: feedback.suggestion_id,
        rating: feedback.rating,
        feedbackText: feedback.feedback_text,
        outcome: feedback.outcome,
        createdAt: feedback.created_at,
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/suggestions/[id]/feedback:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/suggestions/[id]/feedback - Get all feedback for a suggestion
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: suggestionId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify suggestion belongs to user
    const { data: suggestion, error: suggestionError } = await supabase
      .from('suggestions')
      .select('id')
      .eq('id', suggestionId)
      .eq('user_id', user.id)
      .single()

    if (suggestionError || !suggestion) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
    }

    const { data: feedbackList, error } = await supabase
      .from('suggestion_feedback')
      .select('*')
      .eq('suggestion_id', suggestionId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching feedback:', error)
      return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 })
    }

    return NextResponse.json({
      feedback: feedbackList.map((f) => ({
        id: f.id,
        suggestionId: f.suggestion_id,
        rating: f.rating,
        feedbackText: f.feedback_text,
        outcome: f.outcome,
        createdAt: f.created_at,
      }))
    })
  } catch (error) {
    console.error('Error in GET /api/suggestions/[id]/feedback:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
