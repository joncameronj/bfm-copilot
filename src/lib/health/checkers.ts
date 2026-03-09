import { createClient } from '@/lib/supabase/server'
import {
  ServiceHealth,
  HealthStatus,
  ServiceCategory,
  RESPONSE_TIME_THRESHOLDS
} from '@/types/health'
import { getPythonAgentUrl } from '@/lib/agent/url'

const PYTHON_AGENT_URL = getPythonAgentUrl()
const CHECK_TIMEOUT_MS = 5000

// Helper to determine status from response time
function getStatusFromResponseTime(
  responseTimeMs: number,
  category: ServiceCategory
): HealthStatus {
  const thresholds = RESPONSE_TIME_THRESHOLDS[category]
  if (responseTimeMs <= thresholds.healthy) return 'healthy'
  if (responseTimeMs <= thresholds.degraded) return 'degraded'
  return 'unhealthy'
}

// Helper for timed fetch with timeout
async function timedFetch(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data?: unknown; responseTimeMs: number }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS)
  const start = performance.now()

  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const responseTimeMs = Math.round(performance.now() - start)
    let data
    try {
      data = await response.json()
    } catch {
      // Non-JSON response is OK for health checks
    }
    return { ok: response.ok, status: response.status, data, responseTimeMs }
  } finally {
    clearTimeout(timeout)
  }
}

// Check Supabase Database connectivity
export async function checkSupabaseDatabase(): Promise<ServiceHealth> {
  const start = performance.now()
  try {
    const supabase = await createClient()
    // Simple query to check database connectivity
    const { error } = await supabase.from('profiles').select('id').limit(1)
    const responseTimeMs = Math.round(performance.now() - start)

    if (error) {
      return {
        name: 'Supabase Database',
        category: 'database',
        status: 'unhealthy',
        responseTimeMs,
        lastChecked: new Date().toISOString(),
        error: error.message,
      }
    }

    return {
      name: 'Supabase Database',
      category: 'database',
      status: getStatusFromResponseTime(responseTimeMs, 'database'),
      responseTimeMs,
      lastChecked: new Date().toISOString(),
      message: 'Database connection successful',
    }
  } catch (error) {
    return {
      name: 'Supabase Database',
      category: 'database',
      status: 'unhealthy',
      responseTimeMs: Math.round(performance.now() - start),
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Check Supabase Auth service
export async function checkSupabaseAuth(): Promise<ServiceHealth> {
  const start = performance.now()
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.getSession()
    const responseTimeMs = Math.round(performance.now() - start)

    // Auth check passes if we can call getSession without error
    // (session may be null if not authenticated, that's OK)
    if (error) {
      return {
        name: 'Supabase Auth',
        category: 'external',
        status: 'unhealthy',
        responseTimeMs,
        lastChecked: new Date().toISOString(),
        error: error.message,
      }
    }

    return {
      name: 'Supabase Auth',
      category: 'external',
      status: getStatusFromResponseTime(responseTimeMs, 'external'),
      responseTimeMs,
      lastChecked: new Date().toISOString(),
      message: 'Auth service responding',
    }
  } catch (error) {
    return {
      name: 'Supabase Auth',
      category: 'external',
      status: 'unhealthy',
      responseTimeMs: Math.round(performance.now() - start),
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Check Python Agent health
export async function checkPythonAgent(): Promise<ServiceHealth> {
  const start = performance.now()
  try {
    const result = await timedFetch(`${PYTHON_AGENT_URL}/health`)

    // Handle auth errors as degraded (service is up but auth may be misconfigured)
    const isAuthError = result.status === 401 || result.status === 403
    const status = result.ok
      ? getStatusFromResponseTime(result.responseTimeMs, 'external')
      : isAuthError
        ? 'degraded'
        : 'unhealthy'

    return {
      name: 'Python Agent',
      category: 'external',
      status,
      responseTimeMs: result.responseTimeMs,
      lastChecked: new Date().toISOString(),
      message: result.ok
        ? 'Agent responding'
        : isAuthError
          ? 'Agent reachable but auth error'
          : undefined,
      error: result.ok
        ? undefined
        : `HTTP ${result.status}${isAuthError ? ' (check API key configuration)' : ''}`,
      details: result.data as Record<string, unknown>,
    }
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.name === 'AbortError'
        ? 'Request timeout (agent may be starting up)'
        : error.message.includes('ECONNREFUSED')
          ? `Connection refused at ${PYTHON_AGENT_URL} - agent not running`
          : error.message
      : 'Connection failed'

    return {
      name: 'Python Agent',
      category: 'external',
      status: 'unhealthy',
      responseTimeMs: Math.round(performance.now() - start),
      lastChecked: new Date().toISOString(),
      error: errorMessage,
    }
  }
}

// Check Anthropic API connectivity
export async function checkAnthropic(): Promise<ServiceHealth> {
  const serviceName = 'Anthropic API'
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return {
      name: serviceName,
      category: 'external',
      status: 'unhealthy',
      responseTimeMs: 0,
      lastChecked: new Date().toISOString(),
      error: 'ANTHROPIC_API_KEY is not configured',
    }
  }

  const start = performance.now()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS)

    // Lightweight probe — list models endpoint
    const response = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const responseTimeMs = Math.round(performance.now() - start)

    return {
      name: serviceName,
      category: 'external',
      status: response.ok
        ? getStatusFromResponseTime(responseTimeMs, 'external')
        : 'unhealthy',
      responseTimeMs,
      lastChecked: new Date().toISOString(),
      message: response.ok ? 'API key valid, service available' : undefined,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    }
  } catch (error) {
    return {
      name: serviceName,
      category: 'external',
      status: 'unhealthy',
      responseTimeMs: Math.round(performance.now() - start),
      lastChecked: new Date().toISOString(),
      error: error instanceof Error
        ? (error.name === 'AbortError' ? 'Request timeout' : error.message)
        : 'Connection failed',
    }
  }
}
