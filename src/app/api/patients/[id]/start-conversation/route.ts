import { createClient } from '@/lib/supabase/server'
import { buildPatientChatContext, generateQuickActions, formatContextForAI } from '@/lib/patient-context'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: patientId } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify patient belongs to user
    const { data: patientCheck } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('user_id', user.id)
      .single()

    if (!patientCheck) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Build complete patient context
    const context = await buildPatientChatContext(supabase, patientId)

    // Generate contextual quick actions
    const quickActions = generateQuickActions(context)

    // Create conversation with patient context
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        patient_id: patientId,
        title: `${context.patient.name} - Consult`,
        thread_id: null,
        conversation_type: 'patient_consult',
        message_count: 0,
      })
      .select()
      .single()

    if (convError || !conversation) {
      console.error('Error creating conversation:', convError)
      return NextResponse.json(
        { error: 'Failed to create conversation' },
        { status: 500 }
      )
    }

    // Insert system message with patient context
    const systemContent = formatContextForAI(context)
    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        role: 'system',
        content: systemContent,
        metadata: {
          type: 'patient_context',
          patientId: patientId,
        },
      })

    if (msgError) {
      console.error('Error creating system message:', msgError)
      // Don't fail the whole request, just log it
    }

    return NextResponse.json({
      conversationId: conversation.id,
      context,
      quickActions,
    })
  } catch (error) {
    console.error('Error in POST /api/patients/[id]/start-conversation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
