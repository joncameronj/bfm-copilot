// src/app/api/admin/rag/stats/route.ts
// Admin RAG statistics API - Aggregate RAG metrics

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Helper to verify admin role
async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

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

// GET /api/admin/rag/stats - Get RAG statistics
export async function GET(request: Request) {
  const supabase = await createClient()

  const auth = await verifyAdmin(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  // Get query params
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate') || null
  const endDate = searchParams.get('endDate') || null

  try {
    // Build base query for logs
    let logsQuery = supabase.from('rag_logs').select('*')

    if (startDate) {
      logsQuery = logsQuery.gte('created_at', startDate)
    }
    if (endDate) {
      logsQuery = logsQuery.lte('created_at', endDate)
    }

    const { data: logs, error } = await logsQuery

    if (error) {
      console.error('Error fetching RAG stats:', error)
      return NextResponse.json(
        { error: 'Failed to fetch RAG stats' },
        { status: 500 }
      )
    }

    const allLogs = logs || []

    // Calculate statistics
    const totalQueries = allLogs.length
    const queriesByRole = allLogs.reduce(
      (acc, log) => {
        acc[log.user_role] = (acc[log.user_role] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const emptyResultCount = allLogs.filter((log) => log.results_count === 0).length
    const emptyResultRate = totalQueries > 0 ? (emptyResultCount / totalQueries) * 100 : 0

    const avgResponseTime =
      totalQueries > 0
        ? allLogs.reduce((sum, log) => sum + (log.response_time_ms || 0), 0) / totalQueries
        : 0

    const avgResultsCount =
      totalQueries > 0
        ? allLogs.reduce((sum, log) => sum + (log.results_count || 0), 0) / totalQueries
        : 0

    const avgSimilarity =
      totalQueries > 0
        ? allLogs
            .filter((log) => log.top_match_similarity !== null)
            .reduce((sum, log) => sum + (log.top_match_similarity || 0), 0) /
          allLogs.filter((log) => log.top_match_similarity !== null).length
        : 0

    const errorCount = allLogs.filter((log) => log.error_message !== null).length
    const errorRate = totalQueries > 0 ? (errorCount / totalQueries) * 100 : 0

    // Response time distribution
    const responseTimeBuckets = {
      fast: allLogs.filter((log) => (log.response_time_ms || 0) < 500).length,
      medium: allLogs.filter(
        (log) => (log.response_time_ms || 0) >= 500 && (log.response_time_ms || 0) < 1000
      ).length,
      slow: allLogs.filter((log) => (log.response_time_ms || 0) >= 1000).length,
    }

    // Similarity score distribution
    const similarityBuckets = {
      high: allLogs.filter((log) => (log.top_match_similarity || 0) >= 0.8).length,
      medium: allLogs.filter(
        (log) =>
          (log.top_match_similarity || 0) >= 0.6 && (log.top_match_similarity || 0) < 0.8
      ).length,
      low: allLogs.filter(
        (log) =>
          (log.top_match_similarity || 0) > 0 && (log.top_match_similarity || 0) < 0.6
      ).length,
      none: allLogs.filter(
        (log) => log.top_match_similarity === null || log.top_match_similarity === 0
      ).length,
    }

    // Daily query volume (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const dailyVolume = allLogs
      .filter((log) => new Date(log.created_at) >= thirtyDaysAgo)
      .reduce(
        (acc, log) => {
          const date = new Date(log.created_at).toISOString().split('T')[0]
          acc[date] = (acc[date] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )

    return NextResponse.json({
      data: {
        summary: {
          totalQueries,
          avgResponseTimeMs: Math.round(avgResponseTime),
          avgResultsCount: Math.round(avgResultsCount * 10) / 10,
          avgSimilarityScore: Math.round(avgSimilarity * 100) / 100,
          emptyResultRate: Math.round(emptyResultRate * 10) / 10,
          errorRate: Math.round(errorRate * 10) / 10,
        },
        queriesByRole,
        responseTimeBuckets,
        similarityBuckets,
        dailyVolume,
      },
    })
  } catch (error) {
    console.error('Error fetching RAG stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch RAG stats' },
      { status: 500 }
    )
  }
}
