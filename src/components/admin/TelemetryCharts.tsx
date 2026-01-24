'use client'

import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent, Spinner } from '@/components/ui'
import { Select } from '@/components/ui/Select'

interface TrendDataPoint {
  date: string
  rate: number | null
  movingAverage: number | null
  total?: number
}

interface UsageTrendPoint {
  date: string
  total: number
  labAnalyses: number
  protocolsGenerated: number
  suggestionsGenerated: number
  conversationsStarted: number
  feedbackSubmitted: number
}

interface TrendsData {
  period: string
  granularity: string
  dateRange: { start: string; end: string }
  trends: {
    suggestions: TrendDataPoint[]
    protocols: TrendDataPoint[]
    usage: UsageTrendPoint[]
  }
  summary: {
    suggestions: { totalFeedback: number; overallRate: number | null }
    protocols: { totalFeedback: number; overallRate: number | null }
    usage: { totalEvents: number }
  }
}

export function TelemetryCharts() {
  const [data, setData] = useState<TrendsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30d')
  const [granularity, setGranularity] = useState('day')

  useEffect(() => {
    fetchTrends()
  }, [period, granularity])

  async function fetchTrends() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period, granularity })
      const res = await fetch(`/api/admin/telemetry/trends?${params}`)
      const result = await res.json()
      setData(result.data)
    } catch (error) {
      console.error('Failed to fetch trends:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    )
  }

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    if (granularity === 'month') {
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Fill missing dates in usage data with zero values for smooth lines
  const fillMissingDates = (usageData: UsageTrendPoint[]): UsageTrendPoint[] => {
    if (usageData.length === 0) return usageData

    const sortedData = [...usageData].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    const filledData: UsageTrendPoint[] = []
    const startDate = new Date(sortedData[0].date)
    const endDate = new Date(sortedData[sortedData.length - 1].date)

    // Create a map for quick lookup
    const dataMap = new Map(sortedData.map((d) => [d.date, d]))

    // Determine interval based on granularity
    const current = new Date(startDate)
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0]
      const existing = dataMap.get(dateStr)

      if (existing) {
        filledData.push(existing)
      } else {
        // Fill with zero values
        filledData.push({
          date: dateStr,
          total: 0,
          labAnalyses: 0,
          protocolsGenerated: 0,
          suggestionsGenerated: 0,
          conversationsStarted: 0,
          feedbackSubmitted: 0,
        })
      }

      // Increment based on granularity
      if (granularity === 'month') {
        current.setMonth(current.getMonth() + 1)
      } else if (granularity === 'week') {
        current.setDate(current.getDate() + 7)
      } else {
        current.setDate(current.getDate() + 1)
      }
    }

    return filledData
  }

  // Get filled usage data
  const filledUsageData = fillMissingDates(data.trends.usage)

  return (
    <div className="space-y-8">
      {/* Period Selector */}
      <div className="flex gap-4">
        <div className="w-32">
          <label className="block text-sm text-neutral-500 mb-1">Period</label>
          <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </Select>
        </div>
        <div className="w-32">
          <label className="block text-sm text-neutral-500 mb-1">Granularity</label>
          <Select value={granularity} onChange={(e) => setGranularity(e.target.value)}>
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-neutral-500">Suggestion Acceptance</div>
            <div className="text-4xl font-semibold mt-2 text-neutral-900">
              {data.summary.suggestions.overallRate ?? 'N/A'}%
            </div>
            <div className="text-sm text-neutral-400 mt-1">
              {data.summary.suggestions.totalFeedback} feedback items
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-neutral-500">Protocol Success</div>
            <div className="text-4xl font-semibold mt-2 text-neutral-900">
              {data.summary.protocols.overallRate ?? 'N/A'}%
            </div>
            <div className="text-sm text-neutral-400 mt-1">
              {data.summary.protocols.totalFeedback} feedback items
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-neutral-500">Total Events</div>
            <div className="text-4xl font-semibold mt-2 text-neutral-900">
              {data.summary.usage.totalEvents}
            </div>
            <div className="text-sm text-neutral-400 mt-1">in this period</div>
          </CardContent>
        </Card>
      </div>

      {/* Accuracy Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Accuracy Trends</CardTitle>
        </CardHeader>
        <CardContent>
          {data.trends.suggestions.length > 0 || data.trends.protocols.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={[
                  ...data.trends.suggestions.map((s) => ({
                    date: s.date,
                    suggestionRate: s.rate,
                    suggestionMA: s.movingAverage,
                  })),
                ].reduce((acc, curr) => {
                  const existing = acc.find((a) => a.date === curr.date)
                  if (existing) {
                    return acc.map((a) =>
                      a.date === curr.date ? { ...a, ...curr } : a
                    )
                  }
                  return [...acc, curr]
                }, data.trends.protocols.map((p) => ({
                  date: p.date,
                  protocolRate: p.rate,
                  protocolMA: p.movingAverage,
                })) as Array<Record<string, string | number | null>>)}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 12, fill: '#737373' }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 12, fill: '#737373' }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  formatter={(value) => [`${value}%`, '']}
                  labelFormatter={formatDate}
                />
                <Legend />
                <ReferenceLine
                  y={80}
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                  label={{ value: '80% Threshold', fill: '#ef4444', fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="suggestionRate"
                  name="Suggestion Acceptance"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="suggestionMA"
                  name="Suggestion (7-day avg)"
                  stroke="#22c55e"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="protocolRate"
                  name="Protocol Success"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="protocolMA"
                  name="Protocol (7-day avg)"
                  stroke="#3b82f6"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-neutral-500 text-center py-8">
              No accuracy data available for this period
            </p>
          )}
        </CardContent>
      </Card>

      {/* Usage Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Trends</CardTitle>
        </CardHeader>
        <CardContent>
          {data.trends.usage.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart
                data={filledUsageData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="labAnalysesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="protocolsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="conversationsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="feedbackGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 12, fill: '#737373' }}
                />
                <YAxis tick={{ fontSize: 12, fill: '#737373' }} />
                <Tooltip labelFormatter={formatDate} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="labAnalyses"
                  name="Lab Analyses"
                  stroke="#8b5cf6"
                  fill="url(#labAnalysesGradient)"
                  strokeWidth={2}
                  dot={filledUsageData.length > 15 ? false : { r: 4, fill: '#8b5cf6' }}
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="protocolsGenerated"
                  name="Protocols"
                  stroke="#3b82f6"
                  fill="url(#protocolsGradient)"
                  strokeWidth={2}
                  dot={filledUsageData.length > 15 ? false : { r: 4, fill: '#3b82f6' }}
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="conversationsStarted"
                  name="Conversations"
                  stroke="#22c55e"
                  fill="url(#conversationsGradient)"
                  strokeWidth={2}
                  dot={filledUsageData.length > 15 ? false : { r: 4, fill: '#22c55e' }}
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="feedbackSubmitted"
                  name="Feedback"
                  stroke="#f59e0b"
                  fill="url(#feedbackGradient)"
                  strokeWidth={2}
                  dot={filledUsageData.length > 15 ? false : { r: 4, fill: '#f59e0b' }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-neutral-500 text-center py-8">
              No usage data available for this period
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
