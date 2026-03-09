import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  checkSupabaseDatabase,
  checkSupabaseAuth,
  checkPythonAgent,
  checkAnthropic
} from '@/lib/health/checkers'
import {
  HealthCheckResponse,
  ServiceHealth,
  ServiceHealthWithHistory,
  HealthStatus,
  FailureEntry
} from '@/types/health'

export const dynamic = 'force-dynamic'

// In-memory failure history cache
const failureHistory: Map<string, FailureEntry[]> = new Map()
const MAX_FAILURES_STORED = 10

function addFailure(serviceName: string, error: string, responseTimeMs?: number) {
  const failures = failureHistory.get(serviceName) || []
  failures.unshift({
    timestamp: new Date().toISOString(),
    error,
    responseTimeMs
  })
  if (failures.length > MAX_FAILURES_STORED) failures.pop()
  failureHistory.set(serviceName, failures)
}

function getFailures(serviceName: string): FailureEntry[] {
  return failureHistory.get(serviceName) || []
}

export async function GET(request: Request) {
  const supabase = await createClient()

  // Verify user is authenticated and is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Run all health checks in parallel
  const checkPromises = [
    checkSupabaseDatabase(),
    checkSupabaseAuth(),
    checkPythonAgent(),
    checkAnthropic(),
  ]

  const results = await Promise.allSettled(checkPromises)

  // Process results and track failures
  const services: ServiceHealthWithHistory[] = results.map((result) => {
    if (result.status === 'rejected') {
      const fallback: ServiceHealthWithHistory = {
        name: 'Unknown Service',
        category: 'internal',
        status: 'unhealthy',
        responseTimeMs: 0,
        lastChecked: new Date().toISOString(),
        error: result.reason?.message || 'Check failed',
        recentFailures: [],
      }
      return fallback
    }

    const health: ServiceHealth = result.value
    if (health.status === 'unhealthy' && health.error) {
      addFailure(health.name, health.error, health.responseTimeMs)
    }

    return {
      ...health,
      recentFailures: getFailures(health.name),
    }
  })

  // Calculate summary
  const summary = {
    healthy: services.filter(s => s.status === 'healthy').length,
    degraded: services.filter(s => s.status === 'degraded').length,
    unhealthy: services.filter(s => s.status === 'unhealthy').length,
    total: services.length,
  }

  // Determine overall status
  let overall: HealthStatus = 'healthy'
  if (summary.unhealthy > 0) overall = 'unhealthy'
  else if (summary.degraded > 0) overall = 'degraded'

  const response: HealthCheckResponse = {
    overall,
    timestamp: new Date().toISOString(),
    services,
    summary,
  }

  return NextResponse.json({ data: response })
}
