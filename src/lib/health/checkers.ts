import { createClient } from '@/lib/supabase/server'
import {
  ServiceHealth,
  HealthStatus,
  ServiceCategory,
  RESPONSE_TIME_THRESHOLDS
} from '@/types/health'

const PYTHON_AGENT_URL = process.env.PYTHON_AGENT_URL || 'http://localhost:8000'
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

    return {
      name: 'Python Agent',
      category: 'external',
      status: result.ok
        ? getStatusFromResponseTime(result.responseTimeMs, 'external')
        : 'unhealthy',
      responseTimeMs: result.responseTimeMs,
      lastChecked: new Date().toISOString(),
      message: result.ok ? 'Agent responding' : undefined,
      error: result.ok ? undefined : `HTTP ${result.status}`,
      details: result.data as Record<string, unknown>,
    }
  } catch (error) {
    return {
      name: 'Python Agent',
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

// Check OpenAI API connectivity
export async function checkOpenAI(): Promise<ServiceHealth> {
  const start = performance.now()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS)

    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const responseTimeMs = Math.round(performance.now() - start)

    return {
      name: 'OpenAI API',
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
      name: 'OpenAI API',
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

// Internal endpoint checker - checks if an endpoint returns 2xx
export async function checkInternalEndpoint(
  name: string,
  path: string,
  baseUrl: string,
  authToken: string
): Promise<ServiceHealth> {
  const start = performance.now()
  try {
    const result = await timedFetch(`${baseUrl}${path}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    })

    return {
      name,
      category: 'internal',
      status: result.ok
        ? getStatusFromResponseTime(result.responseTimeMs, 'internal')
        : 'unhealthy',
      responseTimeMs: result.responseTimeMs,
      lastChecked: new Date().toISOString(),
      message: result.ok ? 'Endpoint responding' : undefined,
      error: result.ok ? undefined : `HTTP ${result.status}`,
    }
  } catch (error) {
    return {
      name,
      category: 'internal',
      status: 'unhealthy',
      responseTimeMs: Math.round(performance.now() - start),
      lastChecked: new Date().toISOString(),
      error: error instanceof Error
        ? (error.name === 'AbortError' ? 'Request timeout' : error.message)
        : 'Connection failed',
    }
  }
}

// List of internal endpoints to check
export const INTERNAL_ENDPOINTS = [
  { name: 'Conversations API', path: '/api/conversations' },
  { name: 'Patients API', path: '/api/patients' },
  { name: 'Labs Results API', path: '/api/labs/results' },
  { name: 'Dashboard Stats API', path: '/api/dashboard/stats' },
  { name: 'Settings Profile API', path: '/api/settings/profile' },
  { name: 'Admin Users API', path: '/api/admin/users' },
  { name: 'Diagnostics API', path: '/api/diagnostics' },
]
