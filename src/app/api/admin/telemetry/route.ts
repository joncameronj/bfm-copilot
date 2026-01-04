import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Helper to verify admin role
async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized', status: 401 }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: 'Forbidden', status: 403 }
  }

  return { user, profile }
}

// GET /api/admin/telemetry - Overview telemetry dashboard
export async function GET() {
  const supabase = await createClient()

  const auth = await verifyAdmin(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    // Get suggestion metrics
    const { data: suggestions } = await supabase
      .from('suggestions')
      .select('id, status')

    const { data: suggestionFeedback } = await supabase
      .from('suggestion_feedback')
      .select('rating')

    const totalSuggestions = suggestions?.length || 0
    const acceptedSuggestions = suggestions?.filter(s => s.status === 'accepted').length || 0
    const thumbsUpSuggestions = suggestionFeedback?.filter(f => f.rating === 'thumbs_up').length || 0
    const suggestionAcceptanceRate = totalSuggestions > 0
      ? Math.round((acceptedSuggestions / totalSuggestions) * 100)
      : 0

    // Get protocol metrics
    const { data: protocols } = await supabase
      .from('protocols')
      .select('id, status')

    const { data: protocolFeedback } = await supabase
      .from('protocol_feedback')
      .select('outcome, rating')

    const totalProtocols = protocols?.length || 0
    const completedProtocols = protocols?.filter(p => p.status === 'completed').length || 0
    const positiveOutcomes = protocolFeedback?.filter(f => f.outcome === 'positive').length || 0
    const totalProtocolFeedback = protocolFeedback?.length || 0
    const protocolSuccessRate = totalProtocolFeedback > 0
      ? Math.round((positiveOutcomes / totalProtocolFeedback) * 100)
      : 0

    // Get general feedback for response accuracy
    const { data: generalFeedback } = await supabase
      .from('feedback')
      .select('rating, feedback_type')

    const totalResponseFeedback = generalFeedback?.filter(f => f.feedback_type === 'response_quality').length || 0
    const positiveResponseFeedback = generalFeedback?.filter(f =>
      f.feedback_type === 'response_quality' && f.rating === 'positive'
    ).length || 0
    const responseAccuracy = totalResponseFeedback > 0
      ? Math.round((positiveResponseFeedback / totalResponseFeedback) * 100)
      : 0

    // Get user counts
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    const { count: totalMembers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'member')

    const { count: totalPractitioners } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'practitioner')

    // Calculate overall accuracy (weighted average)
    const totalFeedbackItems = (suggestionFeedback?.length || 0) + (protocolFeedback?.length || 0)
    const positiveItems = thumbsUpSuggestions + positiveOutcomes
    const overallAccuracy = totalFeedbackItems > 0
      ? Math.round((positiveItems / totalFeedbackItems) * 100)
      : 0

    // Alert status
    const alerts = []
    if (suggestionAcceptanceRate < 80 && totalSuggestions > 10) {
      alerts.push({
        type: 'warning',
        metric: 'suggestion_acceptance',
        message: `Suggestion acceptance rate is ${suggestionAcceptanceRate}% (below 80% threshold)`,
        value: suggestionAcceptanceRate,
        threshold: 80,
      })
    }
    if (protocolSuccessRate < 80 && totalProtocolFeedback > 10) {
      alerts.push({
        type: 'warning',
        metric: 'protocol_success',
        message: `Protocol success rate is ${protocolSuccessRate}% (below 80% threshold)`,
        value: protocolSuccessRate,
        threshold: 80,
      })
    }
    if (responseAccuracy < 80 && totalResponseFeedback > 10) {
      alerts.push({
        type: 'warning',
        metric: 'response_accuracy',
        message: `Response accuracy is ${responseAccuracy}% (below 80% threshold)`,
        value: responseAccuracy,
        threshold: 80,
      })
    }

    return NextResponse.json({
      data: {
        metrics: {
          suggestionAcceptanceRate,
          protocolSuccessRate,
          responseAccuracy,
          overallAccuracy,
        },
        counts: {
          totalSuggestions,
          acceptedSuggestions,
          totalProtocols,
          completedProtocols,
          totalUsers: totalUsers || 0,
          totalMembers: totalMembers || 0,
          totalPractitioners: totalPractitioners || 0,
        },
        feedback: {
          suggestions: {
            total: suggestionFeedback?.length || 0,
            thumbsUp: thumbsUpSuggestions,
            thumbsDown: (suggestionFeedback?.length || 0) - thumbsUpSuggestions,
          },
          protocols: {
            total: totalProtocolFeedback,
            positive: positiveOutcomes,
            negative: protocolFeedback?.filter(f => f.outcome === 'negative').length || 0,
            neutral: protocolFeedback?.filter(f => f.outcome === 'neutral').length || 0,
            partial: protocolFeedback?.filter(f => f.outcome === 'partial').length || 0,
          },
        },
        alerts,
      },
    })
  } catch (error) {
    console.error('Error fetching telemetry:', error)
    return NextResponse.json({ error: 'Failed to fetch telemetry' }, { status: 500 })
  }
}
