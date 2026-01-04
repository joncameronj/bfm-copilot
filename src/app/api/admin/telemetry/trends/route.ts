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

// GET /api/admin/telemetry/trends - Time-series telemetry data
export async function GET(request: Request) {
  const supabase = await createClient()

  const auth = await verifyAdmin(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || '30d' // 7d, 30d, 90d, 1y
  const granularity = searchParams.get('granularity') || 'day' // day, week, month

  // Calculate date range
  const endDate = new Date()
  let startDate = new Date()

  switch (period) {
    case '7d':
      startDate.setDate(endDate.getDate() - 7)
      break
    case '30d':
      startDate.setDate(endDate.getDate() - 30)
      break
    case '90d':
      startDate.setDate(endDate.getDate() - 90)
      break
    case '1y':
      startDate.setFullYear(endDate.getFullYear() - 1)
      break
    default:
      startDate.setDate(endDate.getDate() - 30)
  }

  try {
    // Get suggestion feedback over time
    const { data: suggestionFeedback } = await supabase
      .from('suggestion_feedback')
      .select('rating, created_at')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true })

    // Get protocol feedback over time
    const { data: protocolFeedback } = await supabase
      .from('protocol_feedback')
      .select('outcome, created_at')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true })

    // Get usage events over time
    const { data: usageEvents } = await supabase
      .from('usage_events')
      .select('event_type, created_at')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true })

    // Group data by date - using generic to preserve item types
    function groupByDate<T extends { created_at: string }>(items: T[], granularity: string): Record<string, T[]> {
      const groups: Record<string, T[]> = {}

      items.forEach(item => {
        const date = new Date(item.created_at)
        let key: string

        switch (granularity) {
          case 'week':
            // Get start of week (Sunday)
            const startOfWeek = new Date(date)
            startOfWeek.setDate(date.getDate() - date.getDay())
            key = startOfWeek.toISOString().split('T')[0]
            break
          case 'month':
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
            break
          default: // day
            key = date.toISOString().split('T')[0]
        }

        if (!groups[key]) {
          groups[key] = []
        }
        groups[key].push(item)
      })

      return groups
    }

    // Calculate suggestion acceptance trend
    const suggestionGroups = groupByDate(suggestionFeedback || [], granularity)
    const suggestionTrend = Object.entries(suggestionGroups).map(([date, items]) => {
      const thumbsUp = items.filter(i => i.rating === 'thumbs_up').length
      const total = items.length
      return {
        date,
        total,
        thumbsUp,
        thumbsDown: total - thumbsUp,
        rate: total > 0 ? Math.round((thumbsUp / total) * 100) : null,
      }
    })

    // Calculate protocol success trend
    const protocolGroups = groupByDate(protocolFeedback || [], granularity)
    const protocolTrend = Object.entries(protocolGroups).map(([date, items]) => {
      const positive = items.filter(i => i.outcome === 'positive').length
      const total = items.length
      return {
        date,
        total,
        positive,
        negative: items.filter(i => i.outcome === 'negative').length,
        neutral: items.filter(i => i.outcome === 'neutral').length,
        partial: items.filter(i => i.outcome === 'partial').length,
        rate: total > 0 ? Math.round((positive / total) * 100) : null,
      }
    })

    // Calculate usage trend
    const usageGroups = groupByDate(usageEvents || [], granularity)
    const usageTrend = Object.entries(usageGroups).map(([date, items]) => {
      return {
        date,
        total: items.length,
        labAnalyses: items.filter(i => i.event_type === 'lab_analysis').length,
        protocolsGenerated: items.filter(i => i.event_type === 'protocol_generated').length,
        suggestionsGenerated: items.filter(i => i.event_type === 'suggestion_generated').length,
        conversationsStarted: items.filter(i => i.event_type === 'conversation_started').length,
        feedbackSubmitted: items.filter(i =>
          i.event_type === 'suggestion_feedback_submitted' || i.event_type === 'protocol_feedback_submitted'
        ).length,
      }
    })

    // Sort all trends by date
    const sortByDate = (a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date)
    suggestionTrend.sort(sortByDate)
    protocolTrend.sort(sortByDate)
    usageTrend.sort(sortByDate)

    // Calculate moving averages for accuracy metrics
    function calculateMovingAverage(data: Array<{ rate: number | null }>, windowSize: number = 7) {
      return data.map((item, index) => {
        const start = Math.max(0, index - windowSize + 1)
        const window = data.slice(start, index + 1)
        const validRates = window.filter(w => w.rate !== null).map(w => w.rate as number)
        const avg = validRates.length > 0
          ? Math.round(validRates.reduce((sum, r) => sum + r, 0) / validRates.length)
          : null
        return { ...item, movingAverage: avg }
      })
    }

    return NextResponse.json({
      data: {
        period,
        granularity,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        trends: {
          suggestions: calculateMovingAverage(suggestionTrend),
          protocols: calculateMovingAverage(protocolTrend),
          usage: usageTrend,
        },
        summary: {
          suggestions: {
            totalFeedback: suggestionFeedback?.length || 0,
            overallRate: suggestionFeedback?.length
              ? Math.round((suggestionFeedback.filter(f => f.rating === 'thumbs_up').length / suggestionFeedback.length) * 100)
              : null,
          },
          protocols: {
            totalFeedback: protocolFeedback?.length || 0,
            overallRate: protocolFeedback?.length
              ? Math.round((protocolFeedback.filter(f => f.outcome === 'positive').length / protocolFeedback.length) * 100)
              : null,
          },
          usage: {
            totalEvents: usageEvents?.length || 0,
          },
        },
      },
    })
  } catch (error) {
    console.error('Error fetching telemetry trends:', error)
    return NextResponse.json({ error: 'Failed to fetch telemetry trends' }, { status: 500 })
  }
}
