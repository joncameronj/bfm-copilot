import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getPythonAgentUrl } from '@/lib/agent/url'

export const dynamic = 'force-dynamic'

// Transform snake_case to camelCase for job response
function transformJob(job: Record<string, unknown>) {
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
    conversation: null, // Will be fetched separately if needed
  }
}

// GET /api/jobs - List jobs for current user
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeRead = searchParams.get('includeRead') === 'true'

    // Fetch jobs (simple query without joins)
    const { data: jobs, error: jobsError } = await supabase
      .from('agent_jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    // Filter in JS if not including read jobs (simpler than complex OR query)
    let filteredJobs = jobs || []
    if (!includeRead) {
      filteredJobs = filteredJobs.filter(job => {
        const isActive = ['pending', 'running', 'streaming'].includes(job.status)
        const isUnreadCompleted = job.status === 'completed' && !job.is_read
        const isFailed = job.status === 'failed'
        return isActive || isUnreadCompleted || isFailed
      })
    }

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError.message, jobsError.code, jobsError)
      // Check if table doesn't exist yet or RLS issue
      if (jobsError.message?.includes('relation') || jobsError.code === '42P01') {
        return NextResponse.json({
          jobs: [],
          activeCount: 0,
          unreadCount: 0,
        })
      }
      // Return more detailed error info
      return NextResponse.json({
        error: jobsError.message || 'Failed to fetch jobs',
        code: jobsError.code,
        details: jobsError.details
      }, { status: 500 })
    }

    // Get counts (wrapped in try-catch in case table doesn't exist)
    let activeCount = 0
    let unreadCount = 0

    try {
      const { count: ac } = await supabase
        .from('agent_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['pending', 'running', 'streaming'])
      activeCount = ac || 0

      const { count: uc } = await supabase
        .from('agent_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .eq('is_read', false)
      unreadCount = uc || 0
    } catch {
      // Counts failed, likely table doesn't exist
    }

    return NextResponse.json({
      jobs: filteredJobs.map(transformJob),
      activeCount,
      unreadCount,
    })
  } catch (error) {
    console.error('Error in GET /api/jobs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/jobs - Create a new background job
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { conversationId, message, context } = body

    if (!conversationId || !message) {
      return NextResponse.json(
        { error: 'conversationId and message are required' },
        { status: 400 }
      )
    }

    // Get user profile for role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = profile?.role || 'member'

    // Create job via Python agent
    const agentResponse = await fetch(`${getPythonAgentUrl()}/agent/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: conversationId,
        user_id: user.id,
        message,
        context: {
          ...context,
          user_role: userRole,
        },
      }),
    })

    if (!agentResponse.ok) {
      const errorData = await agentResponse.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to create job' },
        { status: agentResponse.status }
      )
    }

    const data = await agentResponse.json()

    return NextResponse.json({
      jobId: data.job_id,
      status: data.status,
      message: data.message,
    })
  } catch (error) {
    console.error('Error in POST /api/jobs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
