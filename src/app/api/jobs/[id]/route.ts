import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Transform snake_case to camelCase for job response
function transformJob(job: Record<string, unknown>) {
  const conversation = job.conversations as Record<string, unknown> | null
  return {
    id: job.id,
    conversationId: job.conversation_id,
    userId: job.user_id,
    status: job.status,
    inputMessage: job.input_message,
    outputContent: job.output_content,
    outputReasoning: job.output_reasoning,
    outputMetadata: job.output_metadata,
    currentStep: job.current_step,
    errorMessage: job.error_message,
    isRead: job.is_read,
    createdAt: job.created_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    conversation: conversation ? {
      id: conversation.id,
      title: conversation.title,
      patientId: conversation.patient_id,
    } : null,
  }
}

// GET /api/jobs/[id] - Get a specific job
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: job, error } = await supabase
      .from('agent_jobs')
      .select('*, conversations(id, title, patient_id)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({ job: transformJob(job) })
  } catch (error) {
    console.error('Error in GET /api/jobs/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
