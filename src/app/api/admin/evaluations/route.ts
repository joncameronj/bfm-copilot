// src/app/api/admin/evaluations/route.ts
// Admin Evaluations API - List and create evaluations

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
    return { error: 'Forbidden - Only admins and practitioners can access evaluations', status: 403 }
  }

  return { user, profile }
}

// GET /api/admin/evaluations - List evaluations
export async function GET(request: Request) {
  const supabase = await createClient()

  const auth = await verifyEvaluator(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  // Get query params
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '50')
  const sessionId = searchParams.get('sessionId') || null
  const careCategory = searchParams.get('careCategory') || null
  const minScore = searchParams.get('minScore') || null
  const maxScore = searchParams.get('maxScore') || null
  const startDate = searchParams.get('startDate') || null
  const endDate = searchParams.get('endDate') || null

  const offset = (page - 1) * pageSize

  try {
    // Build query
    let query = supabase
      .from('rag_evaluations')
      .select(
        `
        id,
        rag_log_id,
        evaluation_session_id,
        evaluator_id,
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
        updated_at,
        profiles!evaluator_id(email, full_name),
        evaluation_sessions(name, status)
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    // Apply filters
    if (sessionId) {
      query = query.eq('evaluation_session_id', sessionId)
    }
    if (careCategory) {
      query = query.eq('care_category', careCategory)
    }
    if (minScore) {
      query = query.gte('accuracy_score', parseInt(minScore))
    }
    if (maxScore) {
      query = query.lte('accuracy_score', parseInt(maxScore))
    }
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data: evaluations, count, error } = await query

    if (error) {
      console.error('Error fetching evaluations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch evaluations' },
        { status: 500 }
      )
    }

    // Get summary stats
    const { data: stats } = await supabase
      .from('rag_evaluations')
      .select('accuracy_score')

    const avgScore = stats?.length
      ? stats.reduce((sum, e) => sum + e.accuracy_score, 0) / stats.length
      : 0

    return NextResponse.json({
      data: evaluations || [],
      pagination: {
        page,
        pageSize,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
      stats: {
        totalEvaluations: count || 0,
        averageScore: Math.round(avgScore * 10) / 10,
      },
    })
  } catch (error) {
    console.error('Error fetching evaluations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch evaluations' },
      { status: 500 }
    )
  }
}

// POST /api/admin/evaluations - Create new evaluation
export async function POST(request: Request) {
  const supabase = await createClient()

  const auth = await verifyEvaluator(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json()

    const {
      ragLogId,
      queryText,
      responseText,
      accuracyScore,
      sourceQualityScore,
      comment,
      improvementSuggestion,
      issueTags,
      sourcesCited,
      sessionId,
      careCategory,
    } = body

    // Validate required fields
    if (!queryText || !responseText || !accuracyScore) {
      return NextResponse.json(
        { error: 'Missing required fields: queryText, responseText, accuracyScore' },
        { status: 400 }
      )
    }

    if (accuracyScore < 1 || accuracyScore > 5) {
      return NextResponse.json(
        { error: 'accuracyScore must be between 1 and 5' },
        { status: 400 }
      )
    }

    // Use the submit_evaluation function if ragLogId is provided
    if (ragLogId) {
      const { data, error } = await supabase.rpc('submit_evaluation', {
        p_rag_log_id: ragLogId,
        p_evaluator_id: auth.user.id,
        p_query_text: queryText,
        p_response_text: responseText,
        p_accuracy_score: accuracyScore,
        p_comment: comment || null,
        p_improvement_suggestion: improvementSuggestion || null,
        p_source_quality_score: sourceQualityScore || null,
        p_issue_tags: issueTags || [],
        p_sources_cited: sourcesCited || [],
        p_session_id: sessionId || null,
        p_care_category: careCategory || null,
      })

      if (error) {
        console.error('Error creating evaluation:', error)
        return NextResponse.json(
          { error: 'Failed to create evaluation' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        data: { id: data },
        message: 'Evaluation created successfully',
      })
    }

    // Direct insert if no ragLogId
    const { data, error } = await supabase
      .from('rag_evaluations')
      .insert({
        evaluator_id: auth.user.id,
        query_text: queryText,
        response_text: responseText,
        accuracy_score: accuracyScore,
        source_quality_score: sourceQualityScore,
        comment,
        improvement_suggestion: improvementSuggestion,
        issue_tags: issueTags || [],
        sources_cited: sourcesCited || [],
        evaluation_session_id: sessionId,
        care_category: careCategory,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating evaluation:', error)
      return NextResponse.json(
        { error: 'Failed to create evaluation' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data,
      message: 'Evaluation created successfully',
    })
  } catch (error) {
    console.error('Error creating evaluation:', error)
    return NextResponse.json(
      { error: 'Failed to create evaluation' },
      { status: 500 }
    )
  }
}
