// src/app/api/admin/rag/validation/route.ts
// Admin Validation Stats API - Frequency validation telemetry

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

// GET /api/admin/rag/validation - Get validation statistics
export async function GET(request: Request) {
  const supabase = await createClient()

  const auth = await verifyAdmin(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '30', 10)

  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    // Get all validation logs
    const { data: logs, error } = await supabase
      .from('frequency_validation_logs')
      .select('*')
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching validation logs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch validation logs' },
        { status: 500 }
      )
    }

    const allLogs = logs || []

    // Calculate summary stats
    const total = allLogs.length
    const passed = allLogs.filter(
      (l) => l.validation_result === 'exact_match' || l.validation_result === 'alias_match'
    ).length
    const rejected = total - passed
    const rejectionRate = total > 0 ? (rejected / total) * 100 : 0

    // Count by result type
    const byResult: Record<string, number> = {}
    for (const log of allLogs) {
      byResult[log.validation_result] = (byResult[log.validation_result] || 0) + 1
    }

    // Hz rejections (prompt issues)
    const hzRejections = allLogs.filter((l) => l.validation_result === 'rejected_hz').length

    // Get top rejected frequencies (aggregated)
    const rejectedFreqs: Record<string, { count: number; rationale: string | null; context: string | null }> = {}
    for (const log of allLogs.filter((l) => l.validation_result.startsWith('rejected'))) {
      if (!rejectedFreqs[log.attempted_frequency]) {
        rejectedFreqs[log.attempted_frequency] = {
          count: 0,
          rationale: log.ai_rationale,
          context: log.rag_context_snippet,
        }
      }
      rejectedFreqs[log.attempted_frequency].count++
    }

    const topRejected = Object.entries(rejectedFreqs)
      .map(([frequency, data]) => ({
        frequency,
        count: data.count,
        sampleRationale: data.rationale,
        sampleContext: data.context,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)

    // Daily volume for chart
    const dailyData: Record<string, { passed: number; rejected: number }> = {}
    for (const log of allLogs) {
      const date = new Date(log.created_at).toISOString().split('T')[0]
      if (!dailyData[date]) {
        dailyData[date] = { passed: 0, rejected: 0 }
      }
      if (log.validation_result.startsWith('rejected')) {
        dailyData[date].rejected++
      } else {
        dailyData[date].passed++
      }
    }

    // Recent logs for drill-down (last 50)
    const recentLogs = allLogs.slice(0, 50).map((log) => ({
      id: log.id,
      attemptedFrequency: log.attempted_frequency,
      validationResult: log.validation_result,
      matchedTo: log.matched_to,
      aiRationale: log.ai_rationale,
      ragContextSnippet: log.rag_context_snippet?.slice(0, 200),
      createdAt: log.created_at,
    }))

    return NextResponse.json({
      data: {
        summary: {
          total,
          passed,
          rejected,
          rejectionRate: Math.round(rejectionRate * 10) / 10,
          hzRejections,
        },
        byResult,
        topRejected,
        dailyData,
        recentLogs,
      },
    })
  } catch (error) {
    console.error('Error fetching validation stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch validation stats' },
      { status: 500 }
    )
  }
}
