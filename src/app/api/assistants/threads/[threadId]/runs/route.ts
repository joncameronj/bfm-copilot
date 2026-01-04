import { createClient } from '@/lib/supabase/server'
import { addMessage, createStreamingResponse } from '@/lib/openai'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ threadId: string }>
}

// POST /api/assistants/threads/[threadId]/runs - Run the assistant with streaming
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { threadId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { message, fileIds, conversationId, instructions } = body

    // Add user message to thread if provided
    if (message) {
      await addMessage(threadId, message, fileIds)
    }

    // Build custom instructions based on context
    let systemInstructions = instructions || ''

    // If we have a conversationId, fetch patient context
    if (conversationId) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('patient_id')
        .eq('id', conversationId)
        .single()

      if (conversation?.patient_id) {
        const { data: patient } = await supabase
          .from('patients')
          .select('first_name, last_name, gender, date_of_birth, chief_complaints, medical_history')
          .eq('id', conversation.patient_id)
          .single()

        if (patient) {
          const age = calculateAge(patient.date_of_birth)
          systemInstructions += `\n\nPatient Context:
- Name: ${patient.first_name} ${patient.last_name}
- Age: ${age} years
- Gender: ${patient.gender}
${patient.chief_complaints ? `- Chief Complaints: ${patient.chief_complaints}` : ''}
${patient.medical_history ? `- Medical History: ${patient.medical_history}` : ''}`
        }
      }
    }

    // Create streaming response
    const stream = createStreamingResponse(threadId, systemInstructions || undefined)

    // Return as SSE stream
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error in POST /api/assistants/threads/[threadId]/runs:', error)
    return NextResponse.json(
      { error: 'Failed to run assistant' },
      { status: 500 }
    )
  }
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
