import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Helper to verify admin/practitioner role
async function verifyAdminRole(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'practitioner'].includes(profile.role)) {
    return null
  }

  return user
}

// GET /api/admin/evaluations/chat/stats - Get aggregated statistics
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const user = await verifyAdminRole(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const evaluatorId = searchParams.get('evaluatorId')

    // Build base query
    let query = supabase
      .from('chat_evaluations')
      .select(`
        id,
        rating,
        content_type,
        is_eval_mode,
        evaluator_id,
        created_at,
        profiles!chat_evaluations_evaluator_id_fkey (
          email
        )
      `)

    // Apply filters
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }
    if (evaluatorId) {
      query = query.eq('evaluator_id', evaluatorId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching stats:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calculate stats
    const stats = {
      totalEvaluations: data?.length || 0,
      byRating: {
        correct: 0,
        partially_correct: 0,
        partially_fail: 0,
        fail: 0,
      } as Record<string, number>,
      byContentType: {
        chat_response: 0,
        protocol: 0,
        patient_analysis: 0,
      } as Record<string, number>,
      byEvaluator: [] as Array<{
        evaluatorId: string
        evaluatorEmail: string
        count: number
      }>,
      timeSeriesData: [] as Array<{
        date: string
        count: number
        avgRating: number
      }>,
      evalModeVsRegular: {
        evalMode: 0,
        regularFeedback: 0,
      },
    }

    // Rating numeric mapping for average calculation
    const ratingValues: Record<string, number> = {
      correct: 4,
      partially_correct: 3,
      partially_fail: 2,
      fail: 1,
    }

    const evaluatorCounts: Record<string, { email: string; count: number }> = {}
    const dailyCounts: Record<string, { count: number; ratingSum: number }> = {}

    data?.forEach((item) => {
      // By rating
      if (item.rating in stats.byRating) {
        stats.byRating[item.rating]++
      }

      // By content type
      if (item.content_type in stats.byContentType) {
        stats.byContentType[item.content_type]++
      }

      // Eval mode vs regular
      if (item.is_eval_mode) {
        stats.evalModeVsRegular.evalMode++
      } else {
        stats.evalModeVsRegular.regularFeedback++
      }

      // By evaluator
      if (item.evaluator_id) {
        const profileData = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
        if (!evaluatorCounts[item.evaluator_id]) {
          evaluatorCounts[item.evaluator_id] = {
            email: profileData?.email || 'Unknown',
            count: 0,
          }
        }
        evaluatorCounts[item.evaluator_id].count++
      }

      // Time series (daily)
      if (item.created_at) {
        const date = item.created_at.split('T')[0]
        if (!dailyCounts[date]) {
          dailyCounts[date] = { count: 0, ratingSum: 0 }
        }
        dailyCounts[date].count++
        dailyCounts[date].ratingSum += ratingValues[item.rating] || 0
      }
    })

    // Convert evaluator counts to array
    stats.byEvaluator = Object.entries(evaluatorCounts)
      .map(([id, data]) => ({
        evaluatorId: id,
        evaluatorEmail: data.email,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10) // Top 10 evaluators

    // Convert daily counts to time series
    stats.timeSeriesData = Object.entries(dailyCounts)
      .map(([date, data]) => ({
        date,
        count: data.count,
        avgRating: data.count > 0 ? Math.round((data.ratingSum / data.count) * 100) / 100 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30) // Last 30 days

    return NextResponse.json({ data: stats })
  } catch (error) {
    console.error('Admin chat evaluations stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
