import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PYTHON_AGENT_URL = process.env.PYTHON_AGENT_URL || 'http://localhost:8000'

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

    // Get form data from request
    const formData = await request.formData()

    // Add user_id to form data for Python agent
    formData.append('user_id', user.id)

    // Forward to Python agent
    const response = await fetch(`${PYTHON_AGENT_URL}/agent/ingest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: 'Document ingestion failed',
      }))
      return NextResponse.json(
        { error: error.message || error.detail },
        { status: response.status }
      )
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Document ingest error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
