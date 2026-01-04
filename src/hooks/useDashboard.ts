'use client'

import { useState, useEffect, useCallback } from 'react'

interface DashboardStats {
  patientCount: number
  labCount: number
  alertCount: number
  monthlyConversations: number
}

interface Activity {
  id: string
  title: string
  conversation_type: string
  created_at: string
}

interface UseDashboardResult {
  stats: DashboardStats | null
  activities: Activity[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useDashboard(): UseDashboardResult {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch stats and activities in parallel
      const [statsResponse, activityResponse] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/dashboard/activity'),
      ])

      if (!statsResponse.ok || !activityResponse.ok) {
        throw new Error('Failed to fetch dashboard data')
      }

      const [statsData, activityData] = await Promise.all([
        statsResponse.json(),
        activityResponse.json(),
      ])

      setStats(statsData.data)
      setActivities(activityData.data || [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  return {
    stats,
    activities,
    isLoading,
    error,
    refetch: fetchDashboard,
  }
}

// Hook for dashboard alerts
interface Alert {
  id: string
  patient_id: string
  patient_first_name: string
  patient_last_name: string
  test_date: string
  ominous_count: number
  ominous_markers_triggered: string[]
}

interface UseDashboardAlertsResult {
  alerts: Alert[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useDashboardAlerts(): UseDashboardAlertsResult {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/dashboard/alerts')

      if (!response.ok) {
        throw new Error('Failed to fetch alerts')
      }

      const { data } = await response.json()
      setAlerts(data || [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  return {
    alerts,
    isLoading,
    error,
    refetch: fetchAlerts,
  }
}
