'use client'

import { useState, useEffect, useCallback } from 'react'

interface RagStats {
  summary: {
    totalQueries: number
    avgResponseTimeMs: number
    avgResultsCount: number
    avgSimilarityScore: number
    emptyResultRate: number
    errorRate: number
  }
  queriesByRole: Record<string, number>
  responseTimeBuckets: {
    fast: number
    medium: number
    slow: number
  }
  similarityBuckets: {
    high: number
    medium: number
    low: number
    none: number
  }
  dailyVolume: Record<string, number>
}

export default function RagTelemetryPage() {
  const [stats, setStats] = useState<RagStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/rag/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch RAG stats:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const StatCard = ({
    title,
    value,
    unit,
    color = 'blue',
  }: {
    title: string
    value: string | number
    unit?: string
    color?: string
  }) => (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className={`text-3xl font-bold text-${color}-600`}>
        {value}
        {unit && <span className="text-lg font-normal text-gray-500 ml-1">{unit}</span>}
      </p>
    </div>
  )

  const ProgressBar = ({
    label,
    value,
    total,
    color,
  }: {
    label: string
    value: number
    total: number
    color: string
  }) => {
    const percentage = total > 0 ? (value / total) * 100 : 0
    return (
      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">{label}</span>
          <span className="font-medium">{value}</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full bg-${color}-500 rounded-full`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[400px]">
        <div className="text-gray-500">Loading telemetry data...</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-800 p-4 rounded-lg">
          Failed to load telemetry data. Please try refreshing the page.
        </div>
      </div>
    )
  }

  const totalQueries = stats.summary.totalQueries
  const totalRoleQueries = Object.values(stats.queriesByRole).reduce((a, b) => a + b, 0)
  const totalResponseTime =
    stats.responseTimeBuckets.fast +
    stats.responseTimeBuckets.medium +
    stats.responseTimeBuckets.slow
  const totalSimilarity =
    stats.similarityBuckets.high +
    stats.similarityBuckets.medium +
    stats.similarityBuckets.low +
    stats.similarityBuckets.none

  return (
    <>
      <div className="flex justify-end mb-6">
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800"
        >
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Queries" value={stats.summary.totalQueries} color="blue" />
        <StatCard
          title="Avg Response Time"
          value={stats.summary.avgResponseTimeMs}
          unit="ms"
          color="green"
        />
        <StatCard
          title="Avg Similarity Score"
          value={`${Math.round(stats.summary.avgSimilarityScore * 100)}%`}
          color="purple"
        />
        <StatCard
          title="Empty Result Rate"
          value={`${stats.summary.emptyResultRate.toFixed(1)}%`}
          color="yellow"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Queries by Role */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Queries by Role</h2>
          <ProgressBar
            label="Admin"
            value={stats.queriesByRole.admin || 0}
            total={totalRoleQueries}
            color="red"
          />
          <ProgressBar
            label="Practitioner"
            value={stats.queriesByRole.practitioner || 0}
            total={totalRoleQueries}
            color="blue"
          />
          <ProgressBar
            label="Member"
            value={stats.queriesByRole.member || 0}
            total={totalRoleQueries}
            color="green"
          />
        </div>

        {/* Response Time Distribution */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Response Time Distribution</h2>
          <ProgressBar
            label="Fast (<500ms)"
            value={stats.responseTimeBuckets.fast}
            total={totalResponseTime}
            color="green"
          />
          <ProgressBar
            label="Medium (500-1000ms)"
            value={stats.responseTimeBuckets.medium}
            total={totalResponseTime}
            color="yellow"
          />
          <ProgressBar
            label="Slow (>1000ms)"
            value={stats.responseTimeBuckets.slow}
            total={totalResponseTime}
            color="red"
          />
        </div>

        {/* Similarity Score Distribution */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Match Quality Distribution</h2>
          <ProgressBar
            label="High (>80%)"
            value={stats.similarityBuckets.high}
            total={totalSimilarity}
            color="green"
          />
          <ProgressBar
            label="Medium (60-80%)"
            value={stats.similarityBuckets.medium}
            total={totalSimilarity}
            color="blue"
          />
          <ProgressBar
            label="Low (<60%)"
            value={stats.similarityBuckets.low}
            total={totalSimilarity}
            color="yellow"
          />
          <ProgressBar
            label="No Match"
            value={stats.similarityBuckets.none}
            total={totalSimilarity}
            color="red"
          />
        </div>

        {/* Additional Stats */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Additional Metrics</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Avg Results per Query</span>
              <span className="font-semibold">{stats.summary.avgResultsCount}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Error Rate</span>
              <span
                className={`font-semibold ${
                  stats.summary.errorRate > 5 ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {stats.summary.errorRate.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Empty Result Rate</span>
              <span
                className={`font-semibold ${
                  stats.summary.emptyResultRate > 20 ? 'text-yellow-600' : 'text-green-600'
                }`}
              >
                {stats.summary.emptyResultRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Volume */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">Daily Query Volume (Last 30 Days)</h2>
        {Object.keys(stats.dailyVolume).length === 0 ? (
          <p className="text-gray-500 text-center py-8">No data available for the past 30 days.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex gap-1 min-w-max items-end h-32">
              {Object.entries(stats.dailyVolume)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, count]) => {
                  const maxCount = Math.max(...Object.values(stats.dailyVolume))
                  const height = maxCount > 0 ? (count / maxCount) * 100 : 0
                  return (
                    <div
                      key={date}
                      className="flex flex-col items-center group"
                      style={{ width: '24px' }}
                    >
                      <div className="relative w-full">
                        <div
                          className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                          style={{ height: `${height}%`, minHeight: count > 0 ? '4px' : '0' }}
                        />
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block">
                          <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                            {date}: {count}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
