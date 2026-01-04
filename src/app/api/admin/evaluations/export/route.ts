// src/app/api/admin/evaluations/export/route.ts
// Admin API - Export evaluations as CSV or JSON

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Helper to verify admin/practitioner role
async function verifyEvaluator(supabase: Awaited<ReturnType<typeof createClient>>) {
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

  if (!profile || !['admin', 'practitioner'].includes(profile.role)) {
    return { error: 'Forbidden', status: 403 }
  }

  return { user, profile }
}

// GET /api/admin/evaluations/export - Export evaluations
export async function GET(request: Request) {
  const supabase = await createClient()

  const auth = await verifyEvaluator(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  // Get query params
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') || 'json'
  const sessionId = searchParams.get('sessionId') || null
  const careCategory = searchParams.get('careCategory') || null
  const startDate = searchParams.get('startDate') || null
  const endDate = searchParams.get('endDate') || null
  const includeResponses = searchParams.get('includeResponses') !== 'false'

  try {
    // Build query
    let query = supabase
      .from('rag_evaluations')
      .select(
        `
        id,
        query_text,
        response_text,
        sources_cited,
        care_category,
        accuracy_score,
        source_quality_score,
        comment,
        improvement_suggestion,
        issue_tags,
        response_time_ms,
        user_role,
        created_at,
        profiles!evaluator_id(email, full_name),
        evaluation_sessions(name)
      `
      )
      .order('created_at', { ascending: false })

    // Apply filters
    if (sessionId) {
      query = query.eq('evaluation_session_id', sessionId)
    }
    if (careCategory) {
      query = query.eq('care_category', careCategory)
    }
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data: evaluations, error } = await query

    if (error) {
      console.error('Error fetching evaluations for export:', error)
      return NextResponse.json(
        { error: 'Failed to fetch evaluations for export' },
        { status: 500 }
      )
    }

    if (format === 'csv') {
      // Generate CSV
      const normalizedEvals = normalizeEvaluations((evaluations || []) as EvaluationRow[])
      const csv = generateCSV(normalizedEvals, includeResponses)

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="evaluations-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    // JSON format with summary
    const normalizedEvals = normalizeEvaluations((evaluations || []) as EvaluationRow[])
    const stats = calculateStats(normalizedEvals)

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      filters: {
        sessionId,
        careCategory,
        startDate,
        endDate,
      },
      summary: stats,
      evaluations: normalizedEvals.map((e) => ({
        id: e.id,
        queryText: includeResponses ? e.query_text : '[truncated]',
        responseText: includeResponses
          ? e.response_text?.substring(0, 500) + (e.response_text?.length > 500 ? '...' : '')
          : '[truncated]',
        sourcesCited: e.sources_cited,
        careCategory: e.care_category,
        accuracyScore: e.accuracy_score,
        sourceQualityScore: e.source_quality_score,
        comment: e.comment,
        improvementSuggestion: e.improvement_suggestion,
        issueTags: e.issue_tags,
        responseTimeMs: e.response_time_ms,
        userRole: e.user_role,
        createdAt: e.created_at,
        evaluator: e.profiles,
        session: e.evaluation_sessions,
      })),
    })
  } catch (error) {
    console.error('Error exporting evaluations:', error)
    return NextResponse.json(
      { error: 'Failed to export evaluations' },
      { status: 500 }
    )
  }
}

interface EvaluationRow {
  id: string
  query_text: string
  response_text: string
  sources_cited: unknown
  care_category: string
  accuracy_score: number
  source_quality_score: number | null
  comment: string | null
  improvement_suggestion: string | null
  issue_tags: string[]
  response_time_ms: number | null
  user_role: string
  created_at: string
  profiles: { email: string; full_name: string | null } | { email: string; full_name: string | null }[] | null
  evaluation_sessions: { name: string } | { name: string }[] | null
}

interface Evaluation {
  id: string
  query_text: string
  response_text: string
  sources_cited: unknown
  care_category: string
  accuracy_score: number
  source_quality_score: number | null
  comment: string | null
  improvement_suggestion: string | null
  issue_tags: string[]
  response_time_ms: number | null
  user_role: string
  created_at: string
  profiles: { email: string; full_name: string | null } | null
  evaluation_sessions: { name: string } | null
}

function normalizeEvaluations(rows: EvaluationRow[]): Evaluation[] {
  return rows.map((row) => ({
    ...row,
    profiles: Array.isArray(row.profiles) ? row.profiles[0] || null : row.profiles,
    evaluation_sessions: Array.isArray(row.evaluation_sessions) ? row.evaluation_sessions[0] || null : row.evaluation_sessions,
  }))
}

function generateCSV(evaluations: Evaluation[], includeResponses: boolean): string {
  const headers = [
    'ID',
    'Created At',
    'Evaluator',
    'Session',
    'Care Category',
    'Accuracy Score',
    'Source Quality Score',
    'Query',
    ...(includeResponses ? ['Response (truncated)'] : []),
    'Comment',
    'Improvement Suggestion',
    'Issue Tags',
    'User Role',
    'Response Time (ms)',
  ]

  const escapeCSV = (value: string | null | undefined): string => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const rows = evaluations.map((e) => [
    e.id,
    e.created_at,
    e.profiles?.email || '',
    e.evaluation_sessions?.name || '',
    e.care_category || '',
    e.accuracy_score,
    e.source_quality_score || '',
    escapeCSV(e.query_text?.substring(0, 200)),
    ...(includeResponses ? [escapeCSV(e.response_text?.substring(0, 200))] : []),
    escapeCSV(e.comment),
    escapeCSV(e.improvement_suggestion),
    (e.issue_tags || []).join('; '),
    e.user_role || '',
    e.response_time_ms || '',
  ])

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
}

function calculateStats(evaluations: Evaluation[]) {
  if (evaluations.length === 0) {
    return {
      totalEvaluations: 0,
      averageAccuracy: 0,
      averageSourceQuality: 0,
      scoreDistribution: {},
      commonIssues: [],
      byCategory: {},
    }
  }

  const avgAccuracy =
    evaluations.reduce((sum, e) => sum + e.accuracy_score, 0) / evaluations.length

  const withSourceQuality = evaluations.filter((e) => e.source_quality_score !== null)
  const avgSourceQuality =
    withSourceQuality.length > 0
      ? withSourceQuality.reduce((sum, e) => sum + (e.source_quality_score || 0), 0) /
        withSourceQuality.length
      : 0

  // Score distribution
  const scoreDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  evaluations.forEach((e) => {
    scoreDistribution[e.accuracy_score] = (scoreDistribution[e.accuracy_score] || 0) + 1
  })

  // Common issues
  const issueCount: Record<string, number> = {}
  evaluations.forEach((e) => {
    (e.issue_tags || []).forEach((tag) => {
      issueCount[tag] = (issueCount[tag] || 0) + 1
    })
  })
  const commonIssues = Object.entries(issueCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }))

  // By category
  const byCategory: Record<string, { count: number; avgScore: number }> = {}
  evaluations.forEach((e) => {
    const cat = e.care_category || 'unknown'
    if (!byCategory[cat]) {
      byCategory[cat] = { count: 0, avgScore: 0 }
    }
    byCategory[cat].count++
    byCategory[cat].avgScore += e.accuracy_score
  })
  Object.keys(byCategory).forEach((cat) => {
    byCategory[cat].avgScore = Math.round((byCategory[cat].avgScore / byCategory[cat].count) * 10) / 10
  })

  return {
    totalEvaluations: evaluations.length,
    averageAccuracy: Math.round(avgAccuracy * 10) / 10,
    averageSourceQuality: Math.round(avgSourceQuality * 10) / 10,
    scoreDistribution,
    commonIssues,
    byCategory,
  }
}
