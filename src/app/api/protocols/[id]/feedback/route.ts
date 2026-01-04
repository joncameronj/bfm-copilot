import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/protocols/[id]/feedback - Submit feedback on protocol outcome
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: protocolId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { outcome, outcomeText, adjustmentsMade, rating, labComparison } = body

    const validOutcomes = ['positive', 'negative', 'neutral', 'partial']
    if (!outcome || !validOutcomes.includes(outcome)) {
      return NextResponse.json({ error: 'Invalid outcome. Must be positive, negative, neutral, or partial' }, { status: 400 })
    }

    if (rating && !['thumbs_up', 'thumbs_down'].includes(rating)) {
      return NextResponse.json({ error: 'Invalid rating' }, { status: 400 })
    }

    // Verify protocol exists and belongs to practitioner
    const { data: protocol, error: protocolError } = await supabase
      .from('protocols')
      .select('id, practitioner_id')
      .eq('id', protocolId)
      .eq('practitioner_id', user.id)
      .single()

    if (protocolError || !protocol) {
      return NextResponse.json({ error: 'Protocol not found' }, { status: 404 })
    }

    // Create feedback
    const { data: feedback, error } = await supabase
      .from('protocol_feedback')
      .insert({
        protocol_id: protocolId,
        practitioner_id: user.id,
        outcome,
        outcome_text: outcomeText || null,
        adjustments_made: adjustmentsMade || null,
        rating: rating || null,
        lab_comparison: labComparison || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating feedback:', error)
      return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 })
    }

    // Update protocol status based on outcome
    let newStatus = 'active'
    if (outcome === 'positive') {
      newStatus = 'completed'
    }

    await supabase
      .from('protocols')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', protocolId)

    // Track usage event
    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_type: 'protocol_feedback_submitted',
      metadata: { protocol_id: protocolId, outcome, rating },
    })

    return NextResponse.json({
      feedback: {
        id: feedback.id,
        protocolId: feedback.protocol_id,
        practitionerId: feedback.practitioner_id,
        outcome: feedback.outcome,
        outcomeText: feedback.outcome_text,
        adjustmentsMade: feedback.adjustments_made,
        rating: feedback.rating,
        labComparison: feedback.lab_comparison,
        createdAt: feedback.created_at,
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/protocols/[id]/feedback:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/protocols/[id]/feedback - Get all feedback for a protocol
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: protocolId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify protocol belongs to practitioner
    const { data: protocol, error: protocolError } = await supabase
      .from('protocols')
      .select('id')
      .eq('id', protocolId)
      .eq('practitioner_id', user.id)
      .single()

    if (protocolError || !protocol) {
      return NextResponse.json({ error: 'Protocol not found' }, { status: 404 })
    }

    const { data: feedbackList, error } = await supabase
      .from('protocol_feedback')
      .select('*')
      .eq('protocol_id', protocolId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching feedback:', error)
      return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 })
    }

    return NextResponse.json({
      feedback: feedbackList.map((f) => ({
        id: f.id,
        protocolId: f.protocol_id,
        practitionerId: f.practitioner_id,
        outcome: f.outcome,
        outcomeText: f.outcome_text,
        adjustmentsMade: f.adjustments_made,
        rating: f.rating,
        labComparison: f.lab_comparison,
        createdAt: f.created_at,
      }))
    })
  } catch (error) {
    console.error('Error in GET /api/protocols/[id]/feedback:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
