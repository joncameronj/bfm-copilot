import { createClient } from '@/lib/supabase/server'
import { cancelRun } from '@/lib/openai/assistant'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ threadId: string; runId: string }>
}

// DELETE /api/assistants/threads/[threadId]/runs/[runId] - Cancel a run
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { threadId, runId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Cancel the run
    const run = await cancelRun(threadId, runId)

    return NextResponse.json({
      success: true,
      run: {
        id: run.id,
        status: run.status,
        cancelledAt: run.cancelled_at,
      },
    })
  } catch (error) {
    console.error('Error in DELETE /api/assistants/threads/[threadId]/runs/[runId]:', error)

    // Handle specific OpenAI errors
    if (error instanceof Error) {
      if (error.message.includes('Cannot cancel run')) {
        return NextResponse.json(
          { error: 'Run cannot be cancelled in its current state' },
          { status: 400 }
        )
      }
      if (error.message.includes('No run found')) {
        return NextResponse.json({ error: 'Run not found' }, { status: 404 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to cancel run' },
      { status: 500 }
    )
  }
}
