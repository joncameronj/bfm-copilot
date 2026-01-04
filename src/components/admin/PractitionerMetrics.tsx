'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Spinner } from '@/components/ui'
import { Badge } from '@/components/ui/Badge'

interface PractitionerData {
  id: string
  email: string
  fullName: string | null
  joinedAt: string
  metrics: {
    protocols: { total: number; active: number; completed: number }
    feedback: {
      total: number
      positive: number
      negative: number
      neutral: number
      partial: number
    }
    successRate: number | null
    patients: { total: number; active: number }
    labsAnalyzed: number
    conversations: number
  }
  alerts: Array<{ type: string; message: string }>
}

interface PractitionersData {
  practitioners: PractitionerData[]
  summary: {
    totalPractitioners: number
    avgSuccessRate: number | null
    totalProtocols: number
    totalPatients: number
  }
}

export function PractitionerMetrics() {
  const [data, setData] = useState<PractitionersData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPractitioners()
  }, [])

  async function fetchPractitioners() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/telemetry/practitioners')
      const result = await res.json()
      setData(result.data)
    } catch (error) {
      console.error('Failed to fetch practitioners:', error)
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

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-neutral-500">Total Practitioners</div>
            <div className="text-4xl font-semibold mt-2 text-neutral-900">
              {data.summary.totalPractitioners}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-neutral-500">Average Success Rate</div>
            <div className={`text-4xl font-semibold mt-2 ${
              data.summary.avgSuccessRate !== null && data.summary.avgSuccessRate < 80
                ? 'text-red-500'
                : 'text-green-600'
            }`}>
              {data.summary.avgSuccessRate ?? 'N/A'}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-neutral-500">Total Protocols</div>
            <div className="text-4xl font-semibold mt-2 text-neutral-900">
              {data.summary.totalProtocols}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-neutral-500">Total Patients</div>
            <div className="text-4xl font-semibold mt-2 text-neutral-900">
              {data.summary.totalPatients}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Practitioners Table */}
      <Card>
        <CardHeader>
          <CardTitle>Practitioner Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {data.practitioners && data.practitioners.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-neutral-500 border-b border-neutral-200">
                    <th className="pb-3 font-medium">Practitioner</th>
                    <th className="pb-3 font-medium text-center">Success Rate</th>
                    <th className="pb-3 font-medium text-center">Protocols</th>
                    <th className="pb-3 font-medium text-center">Patients</th>
                    <th className="pb-3 font-medium text-center">Labs</th>
                    <th className="pb-3 font-medium text-center">Conversations</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {data.practitioners.map((practitioner) => (
                    <tr key={practitioner.id} className="hover:bg-neutral-50">
                      <td className="py-4">
                        <div className="font-medium text-neutral-900">
                          {practitioner.fullName || 'Unknown'}
                        </div>
                        <div className="text-sm text-neutral-500">
                          {practitioner.email}
                        </div>
                      </td>
                      <td className="py-4 text-center">
                        {practitioner.metrics.successRate !== null ? (
                          <span className={`font-semibold ${
                            practitioner.metrics.successRate >= 80
                              ? 'text-green-600'
                              : practitioner.metrics.successRate >= 60
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }`}>
                            {practitioner.metrics.successRate}%
                          </span>
                        ) : (
                          <span className="text-neutral-400">N/A</span>
                        )}
                      </td>
                      <td className="py-4 text-center">
                        <div className="text-neutral-900">{practitioner.metrics.protocols.total}</div>
                        <div className="text-xs text-neutral-500">
                          {practitioner.metrics.protocols.active} active
                        </div>
                      </td>
                      <td className="py-4 text-center">
                        <div className="text-neutral-900">{practitioner.metrics.patients.total}</div>
                        <div className="text-xs text-neutral-500">
                          {practitioner.metrics.patients.active} active
                        </div>
                      </td>
                      <td className="py-4 text-center text-neutral-600">
                        {practitioner.metrics.labsAnalyzed}
                      </td>
                      <td className="py-4 text-center text-neutral-600">
                        {practitioner.metrics.conversations}
                      </td>
                      <td className="py-4">
                        {practitioner.alerts.length > 0 ? (
                          <Badge variant="danger" size="sm">
                            Below Threshold
                          </Badge>
                        ) : practitioner.metrics.successRate !== null ? (
                          <Badge variant="success" size="sm">
                            Good
                          </Badge>
                        ) : (
                          <Badge variant="neutral" size="sm">
                            No Data
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-neutral-500 text-center py-4">
              No practitioners found
            </p>
          )}
        </CardContent>
      </Card>

      {/* Feedback Breakdown per Practitioner */}
      <Card>
        <CardHeader>
          <CardTitle>Feedback Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.practitioners
              .filter((p) => p.metrics.feedback.total > 0)
              .map((practitioner) => {
                const { positive, negative, neutral, partial, total } = practitioner.metrics.feedback
                return (
                  <div key={practitioner.id} className="flex items-center gap-4">
                    <div className="w-40 truncate text-sm font-medium">
                      {practitioner.fullName || practitioner.email}
                    </div>
                    <div className="flex-1 h-4 bg-neutral-100 rounded-full overflow-hidden flex">
                      <div
                        className="bg-green-500 h-full"
                        style={{ width: `${(positive / total) * 100}%` }}
                        title={`Positive: ${positive}`}
                      />
                      <div
                        className="bg-yellow-500 h-full"
                        style={{ width: `${(partial / total) * 100}%` }}
                        title={`Partial: ${partial}`}
                      />
                      <div
                        className="bg-neutral-400 h-full"
                        style={{ width: `${(neutral / total) * 100}%` }}
                        title={`Neutral: ${neutral}`}
                      />
                      <div
                        className="bg-red-500 h-full"
                        style={{ width: `${(negative / total) * 100}%` }}
                        title={`Negative: ${negative}`}
                      />
                    </div>
                    <div className="w-16 text-right text-sm text-neutral-500">
                      {total} total
                    </div>
                  </div>
                )
              })}
            {data.practitioners.every((p) => p.metrics.feedback.total === 0) && (
              <p className="text-neutral-500 text-center py-4">
                No feedback data available
              </p>
            )}
          </div>
          {data.practitioners.some((p) => p.metrics.feedback.total > 0) && (
            <div className="flex gap-6 mt-4 pt-4 border-t border-neutral-200">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm text-neutral-600">Positive</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-sm text-neutral-600">Partial</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-neutral-400" />
                <span className="text-sm text-neutral-600">Neutral</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm text-neutral-600">Negative</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
