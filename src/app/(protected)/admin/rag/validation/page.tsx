'use client'

import { useState, useEffect, useCallback } from 'react'

interface ValidationStats {
  summary: {
    total: number
    passed: number
    rejected: number
    rejectionRate: number
    hzRejections: number
  }
  byResult: Record<string, number>
  topRejected: Array<{
    frequency: string
    count: number
    sampleRationale: string | null
    sampleContext: string | null
  }>
  dailyData: Record<string, { passed: number; rejected: number }>
  recentLogs: Array<{
    id: string
    attemptedFrequency: string
    validationResult: string
    matchedTo: string | null
    aiRationale: string | null
    ragContextSnippet: string | null
    createdAt: string
  }>
}

export default function ValidationDashboardPage() {
  const [stats, setStats] = useState<ValidationStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/rag/validation?days=${days}`)
      if (response.ok) {
        const data = await response.json()
        setStats(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch validation stats:', error)
    } finally {
      setIsLoading(false)
    }
  }, [days])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const StatCard = ({
    title,
    value,
    subtitle,
    color = 'blue',
    alert = false,
  }: {
    title: string
    value: string | number
    subtitle?: string
    color?: string
    alert?: boolean
  }) => (
    <div className={`bg-white rounded-xl shadow-sm border p-6 ${alert ? 'border-red-300' : ''}`}>
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className={`text-3xl font-bold ${alert ? 'text-red-600' : `text-${color}-600`}`}>
        {value}
      </p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  )

  const getResultBadgeColor = (result: string) => {
    if (result === 'exact_match') return 'bg-green-100 text-green-700'
    if (result === 'alias_match') return 'bg-blue-100 text-blue-700'
    if (result === 'rejected_hz') return 'bg-red-100 text-red-700'
    if (result === 'rejected_unknown') return 'bg-yellow-100 text-yellow-700'
    return 'bg-gray-100 text-gray-700'
  }

  const getResultLabel = (result: string) => {
    const labels: Record<string, string> = {
      exact_match: 'Exact Match',
      alias_match: 'Alias Match',
      fuzzy_match: 'Fuzzy Match',
      rejected_hz: 'Rejected (Hz)',
      rejected_unknown: 'Rejected (Unknown)',
    }
    return labels[result] || result
  }

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[400px]">
        <div className="text-gray-500">Loading validation telemetry...</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg">
          No validation data available yet. Data will appear after diagnostics are analyzed.
        </div>
      </div>
    )
  }

  const totalByResult = Object.values(stats.byResult).reduce((a, b) => a + b, 0)

  return (
    <>
      {/* Controls */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">Time range:</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800"
        >
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard title="Total Validations" value={stats.summary.total} color="blue" />
        <StatCard title="Passed" value={stats.summary.passed} color="green" />
        <StatCard title="Rejected" value={stats.summary.rejected} color="yellow" />
        <StatCard
          title="Rejection Rate"
          value={`${stats.summary.rejectionRate}%`}
          color={stats.summary.rejectionRate > 10 ? 'red' : 'green'}
          alert={stats.summary.rejectionRate > 10}
        />
        <StatCard
          title="Hz Rejections"
          value={stats.summary.hzRejections}
          subtitle="Prompt issues"
          alert={stats.summary.hzRejections > 0}
          color="red"
        />
      </div>

      {/* Hz Alert Banner */}
      {stats.summary.hzRejections > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8">
          <div className="flex items-start gap-3">
            <div className="text-red-500 text-xl">!</div>
            <div>
              <h3 className="font-semibold text-red-800">AI Prompt Issue Detected</h3>
              <p className="text-sm text-red-700 mt-1">
                The AI attempted to output Hz values ({stats.summary.hzRejections} times). This indicates
                the system prompt may need strengthening or the RAG context is including Hz data.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Result Distribution */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Validation Results</h2>
          <div className="space-y-3">
            {Object.entries(stats.byResult)
              .sort((a, b) => b[1] - a[1])
              .map(([result, count]) => {
                const percentage = totalByResult > 0 ? (count / totalByResult) * 100 : 0
                return (
                  <div key={result}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs ${getResultBadgeColor(result)}`}>
                        {getResultLabel(result)}
                      </span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          result.startsWith('rejected') ? 'bg-red-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Top Rejected Frequencies */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-2">Top Rejected Frequencies</h2>
          <p className="text-sm text-gray-500 mb-4">Candidates for adding to approved list</p>
          {stats.topRejected.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No rejections recorded</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {stats.topRejected.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                  onClick={() => setExpandedLog(expandedLog === item.frequency ? null : item.frequency)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.frequency}</p>
                    {expandedLog === item.frequency && item.sampleRationale && (
                      <p className="text-xs text-gray-500 mt-1">{item.sampleRationale}</p>
                    )}
                  </div>
                  <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                    {item.count}x
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daily Trend Chart */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Daily Validation Volume</h2>
        {Object.keys(stats.dailyData).length === 0 ? (
          <p className="text-gray-500 text-center py-8">No data available for the selected period.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex gap-1 min-w-max items-end h-32">
              {Object.entries(stats.dailyData)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, data]) => {
                  const total = data.passed + data.rejected
                  const maxTotal = Math.max(
                    ...Object.values(stats.dailyData).map((d) => d.passed + d.rejected)
                  )
                  const height = maxTotal > 0 ? (total / maxTotal) * 100 : 0
                  const rejectedHeight = total > 0 ? (data.rejected / total) * height : 0
                  const passedHeight = height - rejectedHeight

                  return (
                    <div
                      key={date}
                      className="flex flex-col items-center group"
                      style={{ width: '24px' }}
                    >
                      <div className="relative w-full flex flex-col-reverse">
                        <div
                          className="w-full bg-green-500 rounded-b"
                          style={{ height: `${passedHeight}%`, minHeight: data.passed > 0 ? '2px' : '0' }}
                        />
                        <div
                          className="w-full bg-red-500 rounded-t"
                          style={{ height: `${rejectedHeight}%`, minHeight: data.rejected > 0 ? '2px' : '0' }}
                        />
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                          <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                            {date}: {data.passed} passed, {data.rejected} rejected
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
            <div className="flex gap-4 mt-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded" />
                <span>Passed</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500 rounded" />
                <span>Rejected</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Logs Table */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Validation Logs</h2>
        {stats.recentLogs.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No logs recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Attempted</th>
                  <th className="text-left py-2 px-3 font-medium">Result</th>
                  <th className="text-left py-2 px-3 font-medium">Matched To</th>
                  <th className="text-left py-2 px-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentLogs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <span className="font-mono text-xs">{log.attemptedFrequency}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${getResultBadgeColor(log.validationResult)}`}>
                        {getResultLabel(log.validationResult)}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {log.matchedTo ? (
                        <span className="text-green-700">{log.matchedTo}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
