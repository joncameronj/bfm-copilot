'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'

interface Alert {
  id: string
  patient_id: string
  patient_first_name: string
  patient_last_name: string
  test_date: string
  ominous_count: number
  ominous_markers_triggered: string[]
}

interface CriticalAlertsProps {
  userId: string
}

export function CriticalAlerts({ userId }: CriticalAlertsProps) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const response = await fetch('/api/dashboard/alerts')
        if (response.ok) {
          const { data } = await response.json()
          setAlerts(data || [])
        }
      } catch (error) {
        console.error('Failed to fetch alerts:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAlerts()
  }, [])

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 bg-neutral-100 rounded-xl" />
        ))}
      </div>
    )
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-green-50 rounded-2xl p-6 text-center">
        <p className="text-green-700">No critical alerts</p>
        <p className="text-sm text-green-600 mt-1">
          All patients are within normal ranges
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="bg-red-50 rounded-2xl p-4"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <Link
                href={`/patients/${alert.patient_id}`}
                className="font-medium text-red-900 hover:underline"
              >
                {alert.patient_first_name} {alert.patient_last_name}
              </Link>
              <p className="text-sm text-red-700">
                Lab from {formatDate(alert.test_date)}
              </p>
            </div>
            <Badge variant="danger">
              {alert.ominous_count} Ominous Markers
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            {alert.ominous_markers_triggered.map((marker) => (
              <span
                key={marker}
                className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs"
              >
                {marker}
              </span>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <Link
              href={`/labs/${alert.id}`}
              className="text-sm text-red-700 hover:underline"
            >
              View Lab Results
            </Link>
            <span className="text-red-300">|</span>
            <Link
              href={`/?patient=${alert.patient_id}`}
              className="text-sm text-red-700 hover:underline"
            >
              Start Conversation
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}
