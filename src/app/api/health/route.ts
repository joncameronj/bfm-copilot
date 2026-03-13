import { NextResponse } from 'next/server'
import { getPythonAgentUrl } from '@/lib/agent/url'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health
 *
 * Public health check — no auth required.
 * Tests Vercel→Railway connectivity and imports used by /api/agent/chat.
 */
export async function GET() {
  const agentUrl = getPythonAgentUrl()
  const checks: Record<string, unknown> = {
    vercel: 'ok',
    pythonAgentUrl: agentUrl,
    pythonAgentUrlSource: process.env.PYTHON_AGENT_URL
      ? 'PYTHON_AGENT_URL'
      : process.env.RAILWAY_PYTHON_AGENT_URL
        ? 'RAILWAY_PYTHON_AGENT_URL'
        : 'fallback (localhost)',
    nodeEnv: process.env.NODE_ENV,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }

  // Test Railway connectivity
  try {
    const start = Date.now()
    const res = await fetch(`${agentUrl}/health`, { cache: 'no-store' })
    const elapsed = Date.now() - start
    const body = await res.json()
    checks.railwayStatus = res.status
    checks.railwayBody = body
    checks.railwayLatencyMs = elapsed
  } catch (err) {
    checks.railwayStatus = 'error'
    checks.railwayError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json(checks)
}
