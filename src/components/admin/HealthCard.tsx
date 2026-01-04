'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusIndicator } from './StatusIndicator'
import { ServiceHealthWithHistory } from '@/types/health'

interface HealthCardProps {
  service: ServiceHealthWithHistory
}

export function HealthCard({ service }: HealthCardProps) {
  const [expanded, setExpanded] = useState(false)

  const categoryColors = {
    database: 'info',
    external: 'neutral',
    internal: 'neutral',
  } as const

  return (
    <Card
      variant="interactive"
      onClick={() => setExpanded(!expanded)}
      className="cursor-pointer"
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{service.name}</CardTitle>
            <Badge variant={categoryColors[service.category]} size="sm" className="mt-1">
              {service.category}
            </Badge>
          </div>
          <StatusIndicator status={service.status} />
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500 dark:text-neutral-400">Response Time</span>
            <span
              className={`font-medium ${
                service.responseTimeMs > 1000
                  ? 'text-red-600 dark:text-red-400'
                  : service.responseTimeMs > 500
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-green-600 dark:text-green-400'
              }`}
            >
              {service.responseTimeMs}ms
            </span>
          </div>

          {service.message && (
            <p className="text-neutral-600 dark:text-neutral-400">{service.message}</p>
          )}

          {service.error && (
            <p className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
              {service.error}
            </p>
          )}

          {expanded && (
            <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700 space-y-3">
              <div className="text-xs text-neutral-400">
                Last checked: {new Date(service.lastChecked).toLocaleString()}
              </div>

              {service.recentFailures.length > 0 && (
                <div>
                  <h4 className="font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Recent Failures ({service.recentFailures.length})
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {service.recentFailures.map((failure, i) => (
                      <div
                        key={i}
                        className="text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded"
                      >
                        <span className="text-neutral-500 dark:text-neutral-400">
                          {new Date(failure.timestamp).toLocaleString()}
                        </span>
                        <span className="text-red-700 dark:text-red-400 ml-2">
                          {failure.error}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {service.details && Object.keys(service.details).length > 0 && (
                <div>
                  <h4 className="font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Details
                  </h4>
                  <pre className="text-xs bg-neutral-100 dark:bg-neutral-800 p-2 rounded overflow-x-auto">
                    {JSON.stringify(service.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {!expanded && (service.recentFailures.length > 0 || service.details) && (
            <p className="text-xs text-neutral-400 mt-2">Click to expand details</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
