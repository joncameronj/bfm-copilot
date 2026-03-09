import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST /api/jobs/[id]/cancel - Cancel a pending or running job
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

    // Only allow cancelling jobs that are not yet completed
    const { data: job, error } = await supabase
      .from('agent_jobs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .in('status', ['pending', 'running', 'streaming'])
      .select()
      .single()

    if (error || !job) {
      return NextResponse.json(
        { error: 'Job not found or already completed' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, jobId: id, status: 'cancelled' })
  } catch (error) {
    console.error('Error in POST /api/jobs/[id]/cancel:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
