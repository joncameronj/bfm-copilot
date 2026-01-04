'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Spinner, DatePicker } from '@/components/ui'
import { format, subDays } from 'date-fns'
import { type AnalyticsData, type UserStatistics } from '@/types/roles'
import { TelemetryCharts } from './TelemetryCharts'
import { PractitionerMetrics } from './PractitionerMetrics'
import { Badge } from '@/components/ui/Badge'

type TabType = 'overview' | 'trends' | 'practitioners' | 'alerts'

interface TelemetryData {
  metrics: {
    suggestionAcceptanceRate: number
    protocolSuccessRate: number
    responseAccuracy: number
    overallAccuracy: number
  }
  counts: {
    totalSuggestions: number
    acceptedSuggestions: number
    totalProtocols: number
    completedProtocols: number
    totalUsers: number
    totalMembers: number
    totalPractitioners: number
  }
  feedback: {
    suggestions: { total: number; thumbsUp: number; thumbsDown: number }
    protocols: { total: number; positive: number; negative: number; neutral: number; partial: number }
  }
  alerts: Array<{ type: string; metric: string; message: string; value: number; threshold: number }>
}

export function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [data, setData] = useState<AnalyticsData & { summary?: Record<string, number> } | null>(null)
  const [telemetryData, setTelemetryData] = useState<TelemetryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 30))
  const [endDate, setEndDate] = useState<Date>(new Date())

  useEffect(() => {
    fetchAnalytics()
    fetchTelemetry()
  }, [startDate, endDate])

  async function fetchAnalytics() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
      })
      const res = await fetch(`/api/admin/analytics?${params}`)
      const result = await res.json()
      setData(result.data)
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchTelemetry() {
    try {
      const res = await fetch('/api/admin/telemetry')
      const result = await res.json()
      setTelemetryData(result.data)
    } catch (error) {
      console.error('Failed to fetch telemetry:', error)
    }
  }

  const tabs: { id: TabType; label: string; alertCount?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'trends', label: 'Trends' },
    { id: 'practitioners', label: 'Practitioners' },
    { id: 'alerts', label: 'Alerts', alertCount: telemetryData?.alerts.length || 0 },
  ]

  // Tab Navigation
  const TabNav = () => (
    <div className="border-b border-neutral-200 mb-8">
      <nav className="-mb-px flex gap-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-4 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-neutral-900 border-b-2 border-neutral-900'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {tab.label}
            {tab.alertCount !== undefined && tab.alertCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                {tab.alertCount}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )

  // Alerts Panel
  const AlertsPanel = () => (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Active Alerts</h2>
      {telemetryData?.alerts && telemetryData.alerts.length > 0 ? (
        <div className="space-y-4">
          {telemetryData.alerts.map((alert, i) => (
            <div key={i} className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 mt-2" />
                <div className="flex-1">
                  <div className="font-medium text-red-800">{alert.message}</div>
                  <div className="text-sm text-red-600 mt-1">
                    Current: {alert.value}% | Threshold: {alert.threshold}%
                  </div>
                </div>
                <Badge variant="danger" size="sm">
                  {alert.metric.replace('_', ' ')}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-4xl mb-4">&#10003;</div>
            <p className="text-neutral-600 font-medium">All systems healthy</p>
            <p className="text-neutral-500 text-sm mt-1">
              No metrics are below the 80% threshold
            </p>
          </CardContent>
        </Card>
      )}

      {/* Threshold Status */}
      <Card>
        <CardHeader>
          <CardTitle>Metric Thresholds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {telemetryData && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">Suggestion Acceptance</span>
                  <div className="flex items-center gap-3">
                    <span className={`font-semibold ${
                      telemetryData.metrics.suggestionAcceptanceRate >= 80 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {telemetryData.metrics.suggestionAcceptanceRate}%
                    </span>
                    <div className="w-32 h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          telemetryData.metrics.suggestionAcceptanceRate >= 80 ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${telemetryData.metrics.suggestionAcceptanceRate}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">Protocol Success</span>
                  <div className="flex items-center gap-3">
                    <span className={`font-semibold ${
                      telemetryData.metrics.protocolSuccessRate >= 80 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {telemetryData.metrics.protocolSuccessRate}%
                    </span>
                    <div className="w-32 h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          telemetryData.metrics.protocolSuccessRate >= 80 ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${telemetryData.metrics.protocolSuccessRate}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">Response Accuracy</span>
                  <div className="flex items-center gap-3">
                    <span className={`font-semibold ${
                      telemetryData.metrics.responseAccuracy >= 80 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {telemetryData.metrics.responseAccuracy}%
                    </span>
                    <div className="w-32 h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          telemetryData.metrics.responseAccuracy >= 80 ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${telemetryData.metrics.responseAccuracy}%` }}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    )
  }

  return (
    <div>
      <TabNav />

      {activeTab === 'trends' && <TelemetryCharts />}
      {activeTab === 'practitioners' && <PractitionerMetrics />}
      {activeTab === 'alerts' && <AlertsPanel />}

      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Date Range */}
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-sm text-neutral-500 mb-1">
                Start Date
              </label>
              <DatePicker
                value={startDate}
                onChange={(date) => date && setStartDate(date)}
                maxDate={endDate}
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-500 mb-1">End Date</label>
              <DatePicker
                value={endDate}
                onChange={(date) => date && setEndDate(date)}
                minDate={startDate}
                maxDate={new Date()}
              />
            </div>
          </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-neutral-500">Protocol Accuracy</div>
            <div className="text-4xl font-semibold mt-2 bg-brand-gradient bg-clip-text text-transparent">
              {data.protocolAccuracy}%
            </div>
            <div className="text-sm text-neutral-400 mt-1">
              Based on {data.totalFeedback} feedback submissions
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-neutral-500">Lab Analyses</div>
            <div className="text-4xl font-semibold mt-2 text-neutral-900">
              {data.eventCounts?.lab_analysis || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-neutral-500">Protocols Generated</div>
            <div className="text-4xl font-semibold mt-2 text-neutral-900">
              {data.eventCounts?.protocol_generated || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-neutral-500">Conversations</div>
            <div className="text-4xl font-semibold mt-2 text-neutral-900">
              {data.eventCounts?.conversation_started || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      {data.summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-neutral-500">Total Users</div>
              <div className="text-2xl font-semibold mt-1 text-neutral-900">
                {data.summary.totalUsers}
              </div>
              <div className="text-sm text-neutral-400">
                {data.summary.activeUsers} active
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-neutral-500">Total Patients</div>
              <div className="text-2xl font-semibold mt-1 text-neutral-900">
                {data.summary.totalPatients}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-neutral-500">Diagnostics Uploaded</div>
              <div className="text-2xl font-semibold mt-1 text-neutral-900">
                {data.eventCounts?.diagnostic_uploaded || 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Feedback Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Feedback Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-8">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500"></div>
              <span className="text-neutral-600">
                Positive: {data.feedbackBreakdown?.positive || 0}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500"></div>
              <span className="text-neutral-600">
                Negative: {data.feedbackBreakdown?.negative || 0}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-neutral-400"></div>
              <span className="text-neutral-600">
                Neutral: {data.feedbackBreakdown?.neutral || 0}
              </span>
            </div>
          </div>

          {/* Simple bar visualization */}
          {data.totalFeedback > 0 && (
            <div className="mt-4 h-4 bg-neutral-100 rounded-full overflow-hidden flex">
              <div
                className="bg-green-500 h-full"
                style={{
                  width: `${((data.feedbackBreakdown?.positive || 0) / data.totalFeedback) * 100}%`,
                }}
              />
              <div
                className="bg-red-500 h-full"
                style={{
                  width: `${((data.feedbackBreakdown?.negative || 0) / data.totalFeedback) * 100}%`,
                }}
              />
              <div
                className="bg-neutral-400 h-full"
                style={{
                  width: `${((data.feedbackBreakdown?.neutral || 0) / data.totalFeedback) * 100}%`,
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Users */}
      <Card>
        <CardHeader>
          <CardTitle>Top Users by Lab Usage</CardTitle>
        </CardHeader>
        <CardContent>
          {data.topUsers && data.topUsers.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-neutral-500">
                  <th className="pb-3">User</th>
                  <th className="pb-3">Role</th>
                  <th className="pb-3">Labs</th>
                  <th className="pb-3">Protocols</th>
                  <th className="pb-3">Conversations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {data.topUsers.map((user: UserStatistics) => (
                  <tr key={user.user_id}>
                    <td className="py-3">
                      <div className="font-medium">
                        {user.full_name || user.email}
                      </div>
                      <div className="text-sm text-neutral-500">
                        {user.email}
                      </div>
                    </td>
                    <td className="py-3 text-neutral-600">{user.role}</td>
                    <td className="py-3 text-neutral-600">{user.labs_count}</td>
                    <td className="py-3 text-neutral-600">
                      {user.protocols_count}
                    </td>
                    <td className="py-3 text-neutral-600">
                      {user.conversations_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-neutral-500 text-center py-4">
              No activity data yet
            </p>
          )}
        </CardContent>
      </Card>
        </div>
      )}
    </div>
  )
}
