import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// GET /api/feedback - List feedback (for WS-5 analytics)
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin (for WS-5 analytics access)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'

    const { searchParams } = new URL(request.url)
    const feedbackType = searchParams.get('feedbackType')
    const rating = searchParams.get('rating')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query = supabase
      .from('feedback')
      .select(`
        id,
        feedback_type,
        rating,
        outcome,
        comment,
        created_at,
        user_id,
        message_id,
        patient_id
      `)
      .order('created_at', { ascending: false })

    // Non-admin users can only see their own feedback
    if (!isAdmin) {
      query = query.eq('user_id', user.id)
    }

    // Apply filters
    if (feedbackType) {
      query = query.eq('feedback_type', feedbackType)
    }
    if (rating) {
      query = query.eq('rating', rating)
    }
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data, error } = await query.limit(100)

    if (error) {
      console.error('Error fetching feedback:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform data
    const feedback = data?.map((item) => ({
      id: item.id,
      feedbackType: item.feedback_type,
      rating: item.rating,
      outcome: item.outcome,
      comment: item.comment,
      createdAt: item.created_at,
      userId: item.user_id,
      messageId: item.message_id,
      patientId: item.patient_id,
    })) || []

    return NextResponse.json({ data: feedback })
  } catch (error) {
    console.error('Feedback GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/feedback - Submit feedback
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { messageId, conversationId, patientId, feedbackType, rating, outcome, comment, messageContent } = body

    // Validate required fields
    if (!feedbackType || !rating) {
      return NextResponse.json(
        { error: 'feedbackType and rating are required' },
        { status: 400 }
      )
    }

    // Validate rating
    const validRatings = ['positive', 'negative', 'neutral']
    if (!validRatings.includes(rating)) {
      return NextResponse.json(
        { error: 'rating must be positive, negative, or neutral' },
        { status: 400 }
      )
    }

    // Validate feedback type
    const validTypes = ['response_quality', 'protocol_outcome', 'general', 'chat_response']
    if (!validTypes.includes(feedbackType)) {
      return NextResponse.json(
        { error: 'Invalid feedback type' },
        { status: 400 }
      )
    }

    // Validate outcome if provided
    if (outcome) {
      const validOutcomes = ['success', 'partial', 'no_improvement']
      if (!validOutcomes.includes(outcome)) {
        return NextResponse.json(
          { error: 'Invalid outcome value' },
          { status: 400 }
        )
      }
    }

    const { data, error } = await supabase
      .from('feedback')
      .insert({
        user_id: user.id,
        message_id: messageId || null,
        conversation_id: conversationId || null,
        patient_id: patientId || null,
        feedback_type: feedbackType,
        rating,
        outcome: outcome || null,
        comment: comment || null,
        message_content: messageContent || null,
        review_status: rating === 'negative' ? 'pending' : null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating feedback:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Track usage event (for WS-5 analytics)
    try {
      await supabase.from('usage_events').insert({
        user_id: user.id,
        event_type: 'feedback_submitted',
        metadata: {
          feedback_id: data.id,
          feedback_type: feedbackType,
          rating,
        },
      })
    } catch {
      // Silently fail - tracking shouldn't break the app
    }

    return NextResponse.json({
      data: {
        id: data.id,
        feedbackType: data.feedback_type,
        rating: data.rating,
        outcome: data.outcome,
        comment: data.comment,
        createdAt: data.created_at,
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Feedback POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
