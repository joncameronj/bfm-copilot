'use client'

import { useState, Fragment } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { StatusIndicator } from './StatusIndicator'
import { ServiceHealthWithHistory, HealthStatus } from '@/types/health'

interface HealthTableProps {
  services: ServiceHealthWithHistory[]
}

type SortField = 'name' | 'status' | 'responseTime'

export function HealthTable({ services }: HealthTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortField>('status')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const statusPriority: Record<HealthStatus, number> = {
    unhealthy: 3,
    degraded: 2,
    healthy: 1,
    unknown: 0
  }

  const sortedServices = [...services].sort((a, b) => {
    let comparison = 0
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name)
        break
      case 'status':
        comparison = statusPriority[a.status] - statusPriority[b.status]
        break
      case 'responseTime':
        comparison = a.responseTimeMs - b.responseTimeMs
        break
    }
    return sortOrder === 'asc' ? comparison : -comparison
  })

  const handleSort = (column: SortField) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return null
    return <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-700 text-left text-sm text-neutral-500 dark:text-neutral-400">
                <th
                  className="px-4 py-3 cursor-pointer hover:text-neutral-900 dark:hover:text-neutral-50 transition-colors"
                  onClick={() => handleSort('name')}
                >
                  Service
                  <SortIcon field="name" />
                </th>
                <th className="px-4 py-3">Category</th>
                <th
                  className="px-4 py-3 cursor-pointer hover:text-neutral-900 dark:hover:text-neutral-50 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  Status
                  <SortIcon field="status" />
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:text-neutral-900 dark:hover:text-neutral-50 transition-colors"
                  onClick={() => handleSort('responseTime')}
                >
                  Response Time
                  <SortIcon field="responseTime" />
                </th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Failures</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {sortedServices.map((service) => (
                <Fragment key={service.name}>
                  <tr
                    className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors"
                    onClick={() =>
                      setExpandedRow(expandedRow === service.name ? null : service.name)
                    }
                  >
                    <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-50">
                      {service.name}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400 capitalize">
                      {service.category}
                    </td>
                    <td className="px-4 py-3">
                      <StatusIndicator status={service.status} showLabel />
                    </td>
                    <td
                      className={`px-4 py-3 font-mono text-sm ${
                        service.responseTimeMs > 1000
                          ? 'text-red-600 dark:text-red-400'
                          : service.responseTimeMs > 500
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {service.responseTimeMs}ms
                    </td>
                    <td className="px-4 py-3 text-sm max-w-xs truncate">
                      {service.error ? (
                        <span className="text-red-600 dark:text-red-400">{service.error}</span>
                      ) : (
                        <span className="text-neutral-500 dark:text-neutral-400">
                          {service.message || '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {service.recentFailures.length > 0 ? (
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          {service.recentFailures.length}
                        </span>
                      ) : (
                        <span className="text-neutral-400">0</span>
                      )}
                    </td>
                  </tr>

                  {expandedRow === service.name && (
                    <tr className="bg-neutral-50 dark:bg-neutral-800/50">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="space-y-3">
                          <div className="text-xs text-neutral-500 dark:text-neutral-400">
                            Last checked: {new Date(service.lastChecked).toLocaleString()}
                          </div>

                          {service.recentFailures.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                                Recent Failures
                              </h4>
                              <div className="space-y-1">
                                {service.recentFailures.map((failure, i) => (
                                  <div
                                    key={i}
                                    className="text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded flex gap-4"
                                  >
                                    <span className="text-neutral-500 dark:text-neutral-400 shrink-0">
                                      {new Date(failure.timestamp).toLocaleString()}
                                    </span>
                                    <span className="text-red-700 dark:text-red-400">
                                      {failure.error}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {service.details && Object.keys(service.details).length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                                Raw Details
                              </h4>
                              <pre className="text-xs bg-neutral-100 dark:bg-neutral-900 p-2 rounded overflow-x-auto">
                                {JSON.stringify(service.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
