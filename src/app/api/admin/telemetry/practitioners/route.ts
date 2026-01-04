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

// GET /api/admin/telemetry/practitioners - Per-practitioner metrics
export async function GET() {
  const supabase = await createClient()

  const auth = await verifyAdmin(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    // Get all practitioners
    const { data: practitioners } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at')
      .in('role', ['practitioner', 'admin'])
      .eq('status', 'active')

    if (!practitioners || practitioners.length === 0) {
      return NextResponse.json({ data: { practitioners: [] } })
    }

    // Get protocols for each practitioner
    const { data: protocols } = await supabase
      .from('protocols')
      .select('id, practitioner_id, status')

    // Get protocol feedback
    const { data: protocolFeedback } = await supabase
      .from('protocol_feedback')
      .select('protocol_id, outcome, rating')

    // Get patients per practitioner
    const { data: patients } = await supabase
      .from('patients')
      .select('id, user_id, status')

    // Get lab results per practitioner
    const { data: labResults } = await supabase
      .from('lab_results')
      .select('id, user_id')

    // Get conversations per practitioner
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, user_id')

    // Build practitioner metrics
    const practitionerMetrics = practitioners.map((p) => {
      // Protocol metrics
      const practitionerProtocols = protocols?.filter(pr => pr.practitioner_id === p.id) || []
      const protocolIds = practitionerProtocols.map(pr => pr.id)
      const practitionerFeedback = protocolFeedback?.filter(f => protocolIds.includes(f.protocol_id)) || []

      const totalProtocols = practitionerProtocols.length
      const completedProtocols = practitionerProtocols.filter(pr => pr.status === 'completed').length
      const activeProtocols = practitionerProtocols.filter(pr => pr.status === 'active').length

      const positiveOutcomes = practitionerFeedback.filter(f => f.outcome === 'positive').length
      const totalFeedback = practitionerFeedback.length
      const successRate = totalFeedback > 0 ? Math.round((positiveOutcomes / totalFeedback) * 100) : null

      // Patient metrics
      const practitionerPatients = patients?.filter(pt => pt.user_id === p.id) || []
      const activePatients = practitionerPatients.filter(pt => pt.status === 'active').length

      // Lab metrics
      const practitionerLabs = labResults?.filter(l => l.user_id === p.id) || []

      // Conversation metrics
      const practitionerConversations = conversations?.filter(c => c.user_id === p.id) || []

      return {
        id: p.id,
        email: p.email,
        fullName: p.full_name,
        joinedAt: p.created_at,
        metrics: {
          protocols: {
            total: totalProtocols,
            active: activeProtocols,
            completed: completedProtocols,
          },
          feedback: {
            total: totalFeedback,
            positive: positiveOutcomes,
            negative: practitionerFeedback.filter(f => f.outcome === 'negative').length,
            neutral: practitionerFeedback.filter(f => f.outcome === 'neutral').length,
            partial: practitionerFeedback.filter(f => f.outcome === 'partial').length,
          },
          successRate,
          patients: {
            total: practitionerPatients.length,
            active: activePatients,
          },
          labsAnalyzed: practitionerLabs.length,
          conversations: practitionerConversations.length,
        },
        alerts: successRate !== null && successRate < 80 ? [{
          type: 'warning',
          message: `Protocol success rate is ${successRate}% (below 80% threshold)`,
        }] : [],
      }
    })

    // Sort by success rate (nulls last)
    practitionerMetrics.sort((a, b) => {
      if (a.metrics.successRate === null) return 1
      if (b.metrics.successRate === null) return -1
      return b.metrics.successRate - a.metrics.successRate
    })

    // Calculate averages
    const practitionersWithData = practitionerMetrics.filter(p => p.metrics.successRate !== null)
    const avgSuccessRate = practitionersWithData.length > 0
      ? Math.round(practitionersWithData.reduce((sum, p) => sum + (p.metrics.successRate || 0), 0) / practitionersWithData.length)
      : null

    const totalProtocolsAll = practitionerMetrics.reduce((sum, p) => sum + p.metrics.protocols.total, 0)
    const totalPatientsAll = practitionerMetrics.reduce((sum, p) => sum + p.metrics.patients.total, 0)

    return NextResponse.json({
      data: {
        practitioners: practitionerMetrics,
        summary: {
          totalPractitioners: practitioners.length,
          avgSuccessRate,
          totalProtocols: totalProtocolsAll,
          totalPatients: totalPatientsAll,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching practitioner telemetry:', error)
    return NextResponse.json({ error: 'Failed to fetch practitioner telemetry' }, { status: 500 })
  }
}
