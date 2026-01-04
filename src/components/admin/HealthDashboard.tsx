'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { HealthCard } from './HealthCard'
import { HealthTable } from './HealthTable'
import { StatusIndicator } from './StatusIndicator'
import { HealthCheckResponse } from '@/types/health'

type ViewMode = 'cards' | 'table'

const REFRESH_INTERVALS = [
  { label: '30s', value: 30000 },
  { label: '60s', value: 60000 },
  { label: 'Off', value: 0 },
]

export function HealthDashboard() {
  const [data, setData] = useState<HealthCheckResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [refreshInterval, setRefreshInterval] = useState(30000)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchHealth = useCallback(async () => {
    try {
      setError(null)
      const response = await fetch('/api/admin/health')
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch health data')
      }
      const result = await response.json()
      setData(result.data)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchHealth()
  }, [fetchHealth])

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval === 0) return
    const interval = setInterval(fetchHealth, refreshInterval)
    return () => clearInterval(interval)
  }, [refreshInterval, fetchHealth])

  const handleManualRefresh = () => {
    setLoading(true)
    fetchHealth()
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" className="text-neutral-500" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-4 rounded-lg flex items-center justify-between">
        <span>Failed to load health data: {error}</span>
        <Button onClick={handleManualRefresh} variant="secondary" size="sm">
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Overall Status */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">System Status:</span>
          <StatusIndicator status={data?.overall || 'unknown'} size="lg" showLabel />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {/* View Toggle */}
          <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-neutral-700 shadow text-neutral-900 dark:text-neutral-50'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-50'
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-neutral-700 shadow text-neutral-900 dark:text-neutral-50'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-50'
              }`}
            >
              Table
            </button>
          </div>

          {/* Refresh Interval */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500 dark:text-neutral-400">Auto-refresh:</span>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="text-sm border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 rounded-lg px-2 py-1.5"
            >
              {REFRESH_INTERVALS.map(({ label, value }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Manual Refresh */}
          <Button
            onClick={handleManualRefresh}
            variant="secondary"
            size="sm"
            isLoading={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Last Updated */}
      {lastRefresh && (
        <p className="text-xs text-neutral-400">
          Last updated: {lastRefresh.toLocaleTimeString()}
        </p>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-neutral-500 dark:text-neutral-400">Total Services</div>
            <div className="text-3xl font-semibold mt-1 text-neutral-900 dark:text-neutral-50">
              {data?.summary.total}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-neutral-500 dark:text-neutral-400">Healthy</div>
            <div className="text-3xl font-semibold mt-1 text-green-600 dark:text-green-400">
              {data?.summary.healthy}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-neutral-500 dark:text-neutral-400">Degraded</div>
            <div className="text-3xl font-semibold mt-1 text-yellow-600 dark:text-yellow-400">
              {data?.summary.degraded}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-neutral-500 dark:text-neutral-400">Unhealthy</div>
            <div className="text-3xl font-semibold mt-1 text-red-600 dark:text-red-400">
              {data?.summary.unhealthy}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Services View */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.services.map((service) => (
            <HealthCard key={service.name} service={service} />
          ))}
        </div>
      ) : (
        <HealthTable services={data?.services || []} />
      )}
    </div>
  )
}
