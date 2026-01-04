// src/app/api/admin/evaluations/unevaluated/route.ts
// Admin API - Get unevaluated RAG logs for the evaluation workflow

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

// GET /api/admin/evaluations/unevaluated - Get unevaluated RAG logs
export async function GET(request: Request) {
  const supabase = await createClient()

  const auth = await verifyEvaluator(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  // Get query params
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '20')
  const careCategory = searchParams.get('careCategory') || null

  const offset = (page - 1) * pageSize

  try {
    // Build query for unevaluated logs
    let query = supabase
      .from('rag_logs')
      .select(
        `
        id,
        user_id,
        conversation_id,
        query,
        search_results,
        results_count,
        top_match_similarity,
        chunks_retrieved,
        response_time_ms,
        user_role,
        created_at,
        profiles!inner(email, full_name),
        messages!inner(content, role)
      `,
        { count: 'exact' }
      )
      .eq('is_evaluated', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    // Note: careCategory filter would need to be applied based on search_results JSONB
    // For now, we'll return all and filter on the frontend

    const { data: logs, count, error } = await query

    if (error) {
      console.error('Error fetching unevaluated logs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch unevaluated logs' },
        { status: 500 }
      )
    }

    // Get total unevaluated count
    const { count: totalUnevaluated } = await supabase
      .from('rag_logs')
      .select('*', { count: 'exact', head: true })
      .eq('is_evaluated', false)

    // Process logs to extract response text from messages
    const processedLogs = (logs || []).map((log) => {
      // Try to find the assistant response after this query
      const assistantMessage = Array.isArray(log.messages)
        ? log.messages.find((m: { role: string }) => m.role === 'assistant')
        : null

      // Extract care category from search results if available
      const searchResults = log.search_results as Array<{ care_category?: string }> | null
      const inferredCategory = searchResults?.[0]?.care_category || null

      return {
        id: log.id,
        userId: log.user_id,
        conversationId: log.conversation_id,
        queryText: log.query,
        responseText: assistantMessage?.content || '[Response not found]',
        searchResults: log.search_results,
        resultsCount: log.results_count,
        topMatchSimilarity: log.top_match_similarity,
        chunksRetrieved: log.chunks_retrieved,
        responseTimeMs: log.response_time_ms,
        userRole: log.user_role,
        careCategory: inferredCategory,
        createdAt: log.created_at,
        user: log.profiles,
      }
    })

    return NextResponse.json({
      data: processedLogs,
      pagination: {
        page,
        pageSize,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
      stats: {
        totalUnevaluated: totalUnevaluated || 0,
      },
    })
  } catch (error) {
    console.error('Error fetching unevaluated logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch unevaluated logs' },
      { status: 500 }
    )
  }
}
