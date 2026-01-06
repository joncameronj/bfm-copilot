import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/protocol-recommendations/[id]/approve
// Approve a protocol recommendation (practitioner thumbs-up)
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: recommendationId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a practitioner or admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (profile.role !== 'practitioner' && profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only practitioners can approve recommendations' },
        { status: 403 }
      )
    }

    // Get the recommendation
    const { data: recommendation, error: recError } = await supabase
      .from('protocol_recommendations')
      .select('id, status, patient_id, diagnostic_analysis_id')
      .eq('id', recommendationId)
      .single()

    if (recError || !recommendation) {
      return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 })
    }

    // Check if already approved or executed
    if (recommendation.status === 'approved') {
      return NextResponse.json({
        message: 'Recommendation already approved',
        data: { status: 'approved' }
      })
    }

    if (recommendation.status === 'executed') {
      return NextResponse.json({
        message: 'Recommendation already executed',
        data: { status: 'executed' }
      })
    }

    if (recommendation.status === 'declined') {
      return NextResponse.json(
        { error: 'Cannot approve a declined recommendation' },
        { status: 400 }
      )
    }

    // Update to approved status
    const { error: updateError } = await supabase
      .from('protocol_recommendations')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.id,
      })
      .eq('id', recommendationId)

    if (updateError) {
      throw new Error(`Failed to approve: ${updateError.message}`)
    }

    // Log usage event
    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_type: 'protocol_recommendation_executed', // Reusing event type
      metadata: {
        action: 'approved',
        recommendation_id: recommendationId,
        patient_id: recommendation.patient_id,
        analysis_id: recommendation.diagnostic_analysis_id,
      },
    })

    return NextResponse.json({
      message: 'Recommendation approved successfully',
      data: {
        id: recommendationId,
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: user.id,
      }
    })

  } catch (error) {
    console.error('Approve recommendation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
