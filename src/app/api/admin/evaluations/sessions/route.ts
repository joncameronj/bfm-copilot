// src/app/api/admin/evaluations/sessions/route.ts
// Admin Evaluation Sessions API - Manage evaluation sessions

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

// GET /api/admin/evaluations/sessions - List evaluation sessions
export async function GET(request: Request) {
  const supabase = await createClient()

  const auth = await verifyEvaluator(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  // Get query params
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || null

  try {
    let query = supabase
      .from('evaluation_sessions')
      .select(
        `
        *,
        profiles!created_by(email, full_name),
        rag_evaluations(count)
      `
      )
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: sessions, error } = await query

    if (error) {
      console.error('Error fetching sessions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      )
    }

    // Get evaluation counts for each session
    const sessionsWithStats = await Promise.all(
      (sessions || []).map(async (session) => {
        const { count } = await supabase
          .from('rag_evaluations')
          .select('*', { count: 'exact', head: true })
          .eq('evaluation_session_id', session.id)

        const { data: avgData } = await supabase
          .from('rag_evaluations')
          .select('accuracy_score')
          .eq('evaluation_session_id', session.id)

        const avgScore = avgData?.length
          ? avgData.reduce((sum, e) => sum + e.accuracy_score, 0) / avgData.length
          : 0

        return {
          ...session,
          evaluation_count: count || 0,
          average_score: Math.round(avgScore * 10) / 10,
        }
      })
    )

    return NextResponse.json({ data: sessionsWithStats })
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
}

// POST /api/admin/evaluations/sessions - Create new session
export async function POST(request: Request) {
  const supabase = await createClient()

  const auth = await verifyEvaluator(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json()

    const { name, description } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Session name is required' },
        { status: 400 }
      )
    }

    const { data: session, error } = await supabase
      .from('evaluation_sessions')
      .insert({
        name,
        description,
        created_by: auth.user.id,
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating session:', error)
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: session,
      message: 'Session created successfully',
    })
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/evaluations/sessions - Update session (via query param id)
export async function PATCH(request: Request) {
  const supabase = await createClient()

  const auth = await verifyEvaluator(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json(
      { error: 'Session ID is required' },
      { status: 400 }
    )
  }

  try {
    const body = await request.json()

    const { name, description, status } = body

    const updateData: Record<string, unknown> = {}

    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (status !== undefined) {
      if (!['active', 'completed', 'archived'].includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status. Must be: active, completed, or archived' },
          { status: 400 }
        )
      }
      updateData.status = status
      if (status === 'completed') {
        updateData.end_date = new Date().toISOString()
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const { data: session, error } = await supabase
      .from('evaluation_sessions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating session:', error)
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: session,
      message: 'Session updated successfully',
    })
  } catch (error) {
    console.error('Error updating session:', error)
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    )
  }
}
