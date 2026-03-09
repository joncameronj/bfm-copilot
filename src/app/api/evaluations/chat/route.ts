import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { EvaluationRating, EvaluationContentType } from '@/types/eval-mode'

export const dynamic = 'force-dynamic'

// Valid values for validation
const VALID_RATINGS: EvaluationRating[] = ['correct', 'partially_correct', 'partially_fail', 'fail']
const VALID_CONTENT_TYPES: EvaluationContentType[] = ['chat_response', 'protocol', 'patient_analysis']

// POST /api/evaluations/chat - Submit a chat evaluation
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has eval mode enabled
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('eval_mode_enabled')
      .eq('user_id', user.id)
      .single()

    if (!preferences?.eval_mode_enabled) {
      return NextResponse.json(
        { error: 'Evaluation mode is not enabled for your account' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      messageId,
      conversationId,
      contentType,
      rating,
      correctAspects,
      needsAdjustment,
      messageContent,
      patientId,
    } = body

    // Validate required fields
    if (!messageId || !conversationId || !contentType || !rating || !messageContent) {
      return NextResponse.json(
        { error: 'Missing required fields: messageId, conversationId, contentType, rating, and messageContent are required' },
        { status: 400 }
      )
    }

    // Validate rating
    if (!VALID_RATINGS.includes(rating)) {
      return NextResponse.json(
        { error: `Invalid rating. Must be one of: ${VALID_RATINGS.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate content type
    if (!VALID_CONTENT_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: `Invalid content type. Must be one of: ${VALID_CONTENT_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate needs_adjustment is provided for non-correct ratings
    if (rating !== 'correct' && (!needsAdjustment || needsAdjustment.trim().length === 0)) {
      return NextResponse.json(
        { error: 'Comment is required for non-correct ratings. Please provide the needsAdjustment field.' },
        { status: 400 }
      )
    }

    // Validate that message exists and belongs to the same conversation before insert.
    // This avoids raw FK errors when client-side temporary IDs are submitted.
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('id, conversation_id')
      .eq('id', messageId)
      .single()

    let resolvedMessageId = messageId
    if (messageError || !message || message.conversation_id !== conversationId) {
      // Compatibility fallback for older client sessions where temporary message IDs
      // were not persisted to DB. Resolve by exact assistant message content.
      const { data: fallbackMessage } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('role', 'assistant')
        .eq('content', messageContent)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!fallbackMessage?.id) {
        return NextResponse.json(
          { error: 'Invalid messageId for this conversation. Reload the conversation and try again.' },
          { status: 400 }
        )
      }

      resolvedMessageId = fallbackMessage.id
    }

    // Insert the evaluation
    const { data, error } = await supabase
      .from('chat_evaluations')
      .insert({
        message_id: resolvedMessageId,
        conversation_id: conversationId,
        evaluator_id: user.id,
        content_type: contentType,
        rating,
        correct_aspects: correctAspects?.trim() || null,
        needs_adjustment: needsAdjustment?.trim() || null,
        message_content: messageContent,
        patient_id: patientId || null,
        is_eval_mode: true,
        metadata: {},
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating chat evaluation:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Track usage event
    try {
      await supabase.from('usage_events').insert({
        user_id: user.id,
        event_type: 'chat_evaluation_submitted',
        metadata: {
          evaluation_id: data.id,
          rating,
          content_type: contentType,
        },
      })
    } catch {
      // Silently fail - tracking shouldn't break the app
    }

    return NextResponse.json({
      data: {
        id: data.id,
        messageId: data.message_id,
        rating: data.rating,
        createdAt: data.created_at,
      },
      message: 'Evaluation submitted successfully',
    }, { status: 201 })
  } catch (error) {
    console.error('Chat evaluation POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/evaluations/chat - Get user's own evaluations (optional, for future use)
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('messageId')
    const conversationId = searchParams.get('conversationId')

    let query = supabase
      .from('chat_evaluations')
      .select(`
        id,
        message_id,
        conversation_id,
        content_type,
        rating,
        correct_aspects,
        needs_adjustment,
        created_at
      `)
      .eq('evaluator_id', user.id)
      .order('created_at', { ascending: false })

    // Apply filters
    if (messageId) {
      query = query.eq('message_id', messageId)
    }
    if (conversationId) {
      query = query.eq('conversation_id', conversationId)
    }

    const { data, error } = await query.limit(100)

    if (error) {
      console.error('Error fetching evaluations:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform to camelCase
    const evaluations = data?.map((item) => ({
      id: item.id,
      messageId: item.message_id,
      conversationId: item.conversation_id,
      contentType: item.content_type,
      rating: item.rating,
      correctAspects: item.correct_aspects,
      needsAdjustment: item.needs_adjustment,
      createdAt: item.created_at,
    })) || []

    return NextResponse.json({ data: evaluations })
  } catch (error) {
    console.error('Chat evaluation GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
