import { NextResponse } from 'next/server'

import { ensureUploadExtractions } from '@/lib/diagnostics/extraction-pipeline'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface RouteParams {
  params: Promise<{ id: string }>
}

function isAuthorized(request: Request): boolean {
  const header = request.headers.get('authorization')
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!header || !expected) {
    return false
  }

  return header === `Bearer ${expected}`
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: uploadId } = await params
    const supabase = createAdminClient()
    const result = await ensureUploadExtractions(supabase, uploadId)

    if (result.recognizedFiles === 0) {
      return NextResponse.json(
        { error: 'No recognized diagnostic files found for extraction', data: result },
        { status: 400 }
      )
    }

    if (result.successfulFiles === 0) {
      return NextResponse.json(
        { error: 'All diagnostic extractions failed', data: result },
        { status: 422 }
      )
    }

    return NextResponse.json({
      data: result,
    })
  } catch (error) {
    console.error('[Internal][Diagnostics] Pending extraction failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
