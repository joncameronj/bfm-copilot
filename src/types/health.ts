// Health status levels
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

// Service categories for grouping and threshold determination
export type ServiceCategory = 'database' | 'external' | 'internal'

// Individual service health check result
export interface ServiceHealth {
  name: string
  category: ServiceCategory
  status: HealthStatus
  responseTimeMs: number
  lastChecked: string // ISO timestamp
  message?: string
  error?: string
  details?: Record<string, unknown>
}

// Failure history entry
export interface FailureEntry {
  timestamp: string
  error: string
  responseTimeMs?: number
}

// Extended health info with history
export interface ServiceHealthWithHistory extends ServiceHealth {
  recentFailures: FailureEntry[]
}

// Overall system health response
export interface HealthCheckResponse {
  overall: HealthStatus
  timestamp: string
  services: ServiceHealthWithHistory[]
  summary: {
    healthy: number
    degraded: number
    unhealthy: number
    total: number
  }
}

// Response time thresholds (in ms) for determining status
export const RESPONSE_TIME_THRESHOLDS = {
  database: { healthy: 200, degraded: 500 },
  external: { healthy: 1000, degraded: 3000 },
  internal: { healthy: 300, degraded: 800 },
} as const
