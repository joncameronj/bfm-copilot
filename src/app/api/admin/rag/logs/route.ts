// src/app/api/admin/rag/logs/route.ts
// Admin RAG logs API - View RAG query logs for monitoring

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

// GET /api/admin/rag/logs - Get RAG query logs
export async function GET(request: Request) {
  const supabase = await createClient()

  const auth = await verifyAdmin(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  // Get query params
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '50')
  const userRole = searchParams.get('userRole') || null
  const startDate = searchParams.get('startDate') || null
  const endDate = searchParams.get('endDate') || null

  const offset = (page - 1) * pageSize

  try {
    // Build query
    let query = supabase
      .from('rag_logs')
      .select(
        `
        id,
        user_id,
        conversation_id,
        query_text,
        user_role,
        role_scope_filter,
        results_count,
        top_match_similarity,
        chunks_retrieved,
        response_time_ms,
        error_message,
        created_at,
        profiles!inner(email, full_name)
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    // Apply filters
    if (userRole) {
      query = query.eq('user_role', userRole)
    }
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data: logs, count, error } = await query

    if (error) {
      console.error('Error fetching RAG logs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch RAG logs' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: logs || [],
      pagination: {
        page,
        pageSize,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    })
  } catch (error) {
    console.error('Error fetching RAG logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch RAG logs' },
      { status: 500 }
    )
  }
}
