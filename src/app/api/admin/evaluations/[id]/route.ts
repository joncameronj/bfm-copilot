// src/app/api/admin/evaluations/[id]/route.ts
// Admin Evaluation API - Get, update, delete single evaluation

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

// GET /api/admin/evaluations/[id] - Get single evaluation
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const auth = await verifyEvaluator(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params

  try {
    const { data: evaluation, error } = await supabase
      .from('rag_evaluations')
      .select(
        `
        *,
        profiles!evaluator_id(email, full_name),
        evaluation_sessions(name, status),
        rag_logs(
          query,
          search_results,
          results_count,
          top_match_similarity,
          response_time_ms
        )
      `
      )
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Evaluation not found' },
          { status: 404 }
        )
      }
      console.error('Error fetching evaluation:', error)
      return NextResponse.json(
        { error: 'Failed to fetch evaluation' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: evaluation })
  } catch (error) {
    console.error('Error fetching evaluation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch evaluation' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/evaluations/[id] - Update evaluation
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const auth = await verifyEvaluator(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params

  try {
    const body = await request.json()

    const {
      accuracyScore,
      sourceQualityScore,
      comment,
      improvementSuggestion,
      issueTags,
    } = body

    // Build update object
    const updateData: Record<string, unknown> = {}

    if (accuracyScore !== undefined) {
      if (accuracyScore < 1 || accuracyScore > 5) {
        return NextResponse.json(
          { error: 'accuracyScore must be between 1 and 5' },
          { status: 400 }
        )
      }
      updateData.accuracy_score = accuracyScore
    }

    if (sourceQualityScore !== undefined) {
      if (sourceQualityScore < 1 || sourceQualityScore > 5) {
        return NextResponse.json(
          { error: 'sourceQualityScore must be between 1 and 5' },
          { status: 400 }
        )
      }
      updateData.source_quality_score = sourceQualityScore
    }

    if (comment !== undefined) {
      updateData.comment = comment
    }

    if (improvementSuggestion !== undefined) {
      updateData.improvement_suggestion = improvementSuggestion
    }

    if (issueTags !== undefined) {
      updateData.issue_tags = issueTags
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const { data: evaluation, error } = await supabase
      .from('rag_evaluations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Evaluation not found' },
          { status: 404 }
        )
      }
      console.error('Error updating evaluation:', error)
      return NextResponse.json(
        { error: 'Failed to update evaluation' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: evaluation,
      message: 'Evaluation updated successfully',
    })
  } catch (error) {
    console.error('Error updating evaluation:', error)
    return NextResponse.json(
      { error: 'Failed to update evaluation' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/evaluations/[id] - Delete evaluation
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const auth = await verifyEvaluator(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params

  try {
    // First, get the evaluation to find the linked rag_log
    const { data: evaluation } = await supabase
      .from('rag_evaluations')
      .select('rag_log_id')
      .eq('id', id)
      .single()

    // Delete the evaluation
    const { error } = await supabase
      .from('rag_evaluations')
      .delete()
      .eq('id', id)

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Evaluation not found' },
          { status: 404 }
        )
      }
      console.error('Error deleting evaluation:', error)
      return NextResponse.json(
        { error: 'Failed to delete evaluation' },
        { status: 500 }
      )
    }

    // Reset the rag_log's is_evaluated flag if it was linked
    if (evaluation?.rag_log_id) {
      await supabase
        .from('rag_logs')
        .update({ is_evaluated: false, evaluation_id: null })
        .eq('id', evaluation.rag_log_id)
    }

    return NextResponse.json({
      message: 'Evaluation deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting evaluation:', error)
    return NextResponse.json(
      { error: 'Failed to delete evaluation' },
      { status: 500 }
    )
  }
}
