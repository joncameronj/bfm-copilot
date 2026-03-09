import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST /api/jobs/[id]/mark-read - Mark a job as read
export async function POST(
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
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Also clear the unread completion flag on the conversation
    await supabase
      .from('conversations')
      .update({ has_unread_completion: false })
      .eq('id', job.conversation_id)

    return NextResponse.json({ success: true, jobId: id })
  } catch (error) {
    console.error('Error in POST /api/jobs/[id]/mark-read:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
