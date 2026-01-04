import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PYTHON_AGENT_URL = process.env.PYTHON_AGENT_URL || 'http://localhost:8000'

interface PatientContext {
  first_name?: string
  last_name?: string
  age?: number
  gender?: string
  chief_complaints?: string
  medical_history?: string
}

function calculateAge(dateOfBirth: string): number {
  const birthDate = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--
  }

  return age
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!user || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user role for content filtering
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = profile?.role || 'member'

    const body = await request.json()
    const { message, conversationId, fileIds } = body

    // Fetch conversation context
    let patientContext: PatientContext | null = null
    let conversationType = 'general'

    if (conversationId) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('patient_id, conversation_type')
        .eq('id', conversationId)
        .single()

      if (conversation?.patient_id) {
        const { data: patient } = await supabase
          .from('patients')
          .select(
            'first_name, last_name, gender, date_of_birth, chief_complaints, medical_history'
          )
          .eq('id', conversation.patient_id)
          .single()

        if (patient) {
          patientContext = {
            first_name: patient.first_name,
            last_name: patient.last_name,
            age: calculateAge(patient.date_of_birth),
            gender: patient.gender,
            chief_complaints: patient.chief_complaints,
            medical_history: patient.medical_history,
          }
        }
      }
      conversationType = conversation?.conversation_type || 'general'
    }

    // Load conversation history
    const { data: messages } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(20)

    // Forward to Python agent with streaming and role-based filtering
    const response = await fetch(`${PYTHON_AGENT_URL}/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
        conversation_type: conversationType,
        patient_context: patientContext,
        history: messages || [],
        file_ids: fileIds,
        user_role: userRole,
        user_id: user.id,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: 'Python agent request failed',
      }))
      console.error('[Python Agent Error]', {
        timestamp: new Date().toISOString(),
        userId: user.id,
        conversationId,
        status: response.status,
        error: errorData,
      })
      return NextResponse.json(
        { error: errorData.message || errorData.detail },
        { status: response.status }
      )
    }

    // Stream response with proper chunk forwarding
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const reader = response.body!.getReader()

    // Process chunks in background - forward immediately without buffering
    ;(async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          await writer.write(value)
        }
      } finally {
        await writer.close()
      }
    })()

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    console.error('[Agent Chat Error]', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
