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

// GET /api/admin/evaluations/chat/[id] - Get single evaluation details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await verifyAdminRole(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const { data, error } = await supabase
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
        metadata,
        created_at,
        updated_at,
        profiles!chat_evaluations_evaluator_id_fkey (
          id,
          email,
          full_name
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 })
      }
      console.error('Error fetching evaluation:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch related message and conversation data
    let message = null
    let conversation = null

    if (data.message_id) {
      const { data: msgData } = await supabase
        .from('messages')
        .select('role, content, created_at')
        .eq('id', data.message_id)
        .single()
      message = msgData
    }

    if (data.conversation_id) {
      const { data: convData } = await supabase
        .from('conversations')
        .select('title, conversation_type')
        .eq('id', data.conversation_id)
        .single()
      conversation = convData
    }

    // Fetch patient if exists
    let patient = null
    if (data.patient_id) {
      const { data: patientData } = await supabase
        .from('patients')
        .select('id, first_name, last_name')
        .eq('id', data.patient_id)
        .single()
      patient = patientData
    }

    // Handle profiles - it may be returned as array or object depending on Supabase version
    const profileData = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles

    // Transform to camelCase
    const evaluation = {
      id: data.id,
      messageId: data.message_id,
      conversationId: data.conversation_id,
      evaluatorId: data.evaluator_id,
      contentType: data.content_type,
      rating: data.rating,
      correctAspects: data.correct_aspects,
      needsAdjustment: data.needs_adjustment,
      messageContent: data.message_content,
      patientId: data.patient_id,
      isEvalMode: data.is_eval_mode,
      metadata: data.metadata,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      evaluator: profileData ? {
        id: profileData.id,
        email: profileData.email,
        fullName: profileData.full_name,
      } : null,
      message: message ? {
        role: message.role,
        content: message.content,
        createdAt: message.created_at,
      } : null,
      conversation: conversation ? {
        title: conversation.title,
        conversationType: conversation.conversation_type,
      } : null,
      patient: patient ? {
        id: patient.id,
        firstName: patient.first_name,
        lastName: patient.last_name,
      } : null,
    }

    return NextResponse.json({ data: evaluation })
  } catch (error) {
    console.error('Admin chat evaluation GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
