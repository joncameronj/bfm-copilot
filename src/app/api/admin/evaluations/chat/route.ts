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

// GET /api/admin/evaluations/chat - List chat evaluations with filters
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const user = await verifyAdminRole(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    const evaluatorId = searchParams.get('evaluatorId')
    const rating = searchParams.get('rating')
    const contentType = searchParams.get('contentType')
    const isEvalMode = searchParams.get('isEvalMode')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build query
    let query = supabase
      .from('chat_evaluations')
      .select(`
        id,
        message_id,
        conversation_id,
        evaluator_id,
        content_type,
        rating,
        correct_aspects,
        needs_adjustment,
        message_content,
        patient_id,
        is_eval_mode,
        created_at,
        updated_at,
        profiles!chat_evaluations_evaluator_id_fkey (
          id,
          email,
          full_name
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    // Apply filters
    if (evaluatorId) {
      query = query.eq('evaluator_id', evaluatorId)
    }
    if (rating) {
      query = query.eq('rating', rating)
    }
    if (contentType) {
      query = query.eq('content_type', contentType)
    }
    if (isEvalMode !== null && isEvalMode !== undefined) {
      query = query.eq('is_eval_mode', isEvalMode === 'true')
    }
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    // Pagination
    const offset = (page - 1) * pageSize
    query = query.range(offset, offset + pageSize - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching chat evaluations:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get stats
    const { data: statsData } = await supabase
      .from('chat_evaluations')
      .select('rating, content_type, is_eval_mode')

    const stats = {
      totalEvaluations: count || 0,
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
      evalModeCount: 0,
      regularFeedbackCount: 0,
    }

    if (statsData) {
      statsData.forEach((item) => {
        if (item.rating in stats.byRating) {
          stats.byRating[item.rating]++
        }
        if (item.content_type in stats.byContentType) {
          stats.byContentType[item.content_type]++
        }
        if (item.is_eval_mode) {
          stats.evalModeCount++
        } else {
          stats.regularFeedbackCount++
        }
      })
    }

    // Transform to camelCase
    const evaluations = data?.map((item) => {
      // Handle profiles - it may be returned as array or object depending on Supabase version
      const profileData = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
      return {
        id: item.id,
        messageId: item.message_id,
        conversationId: item.conversation_id,
        evaluatorId: item.evaluator_id,
        contentType: item.content_type,
        rating: item.rating,
        correctAspects: item.correct_aspects,
        needsAdjustment: item.needs_adjustment,
        messageContent: item.message_content?.substring(0, 200) + (item.message_content?.length > 200 ? '...' : ''),
        patientId: item.patient_id,
        isEvalMode: item.is_eval_mode,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        evaluator: profileData ? {
          id: profileData.id,
          email: profileData.email,
          fullName: profileData.full_name,
        } : null,
      }
    }) || []

    return NextResponse.json({
      data: evaluations,
      pagination: {
        page,
        pageSize,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
      stats,
    })
  } catch (error) {
    console.error('Admin chat evaluations GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
