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

// GET /api/admin/evaluations/chat/export - Export chat evaluations as CSV or JSON
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const user = await verifyAdminRole(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    const evaluatorId = searchParams.get('evaluatorId')
    const rating = searchParams.get('rating')
    const contentType = searchParams.get('contentType')
    const isEvalMode = searchParams.get('isEvalMode')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build query (limit to 10000 for performance)
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
        profiles!chat_evaluations_evaluator_id_fkey (
          email,
          full_name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10000)

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

    const { data, error } = await query

    if (error) {
      console.error('Error fetching evaluations for export:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'ID',
        'Created At',
        'Evaluator Email',
        'Evaluator Name',
        'Content Type',
        'Rating',
        'Is Eval Mode',
        'Correct Aspects',
        'Needs Adjustment',
        'Message Content',
        'Patient ID',
        'Conversation ID',
        'Message ID',
      ]

      const rows = data?.map((item) => {
        const profileData = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
        return [
          item.id,
          item.created_at,
          profileData?.email || '',
          profileData?.full_name || '',
          item.content_type,
          item.rating,
          item.is_eval_mode ? 'Yes' : 'No',
          (item.correct_aspects || '').replace(/"/g, '""').substring(0, 500),
          (item.needs_adjustment || '').replace(/"/g, '""').substring(0, 500),
          (item.message_content || '').replace(/"/g, '""').substring(0, 500),
          item.patient_id || '',
          item.conversation_id,
          item.message_id,
        ]
      })

      const csv = [
        headers.join(','),
        ...(rows || []).map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n')

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="chat-evaluations-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    } else {
      // JSON format
      const evaluations = data?.map((item) => {
        const profileData = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
        return {
          id: item.id,
          createdAt: item.created_at,
          evaluatorEmail: profileData?.email,
          evaluatorName: profileData?.full_name,
          contentType: item.content_type,
          rating: item.rating,
          isEvalMode: item.is_eval_mode,
          correctAspects: item.correct_aspects,
          needsAdjustment: item.needs_adjustment,
          messageContent: item.message_content,
          patientId: item.patient_id,
          conversationId: item.conversation_id,
          messageId: item.message_id,
        }
      }) || []

      return new NextResponse(JSON.stringify(evaluations, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="chat-evaluations-${new Date().toISOString().split('T')[0]}.json"`,
        },
      })
    }
  } catch (error) {
    console.error('Admin chat evaluations export error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
