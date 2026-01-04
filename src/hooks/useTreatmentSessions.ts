'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  TreatmentSessionWithDetails,
  TreatmentSessionFilters,
  CreateTreatmentSessionInput,
  UpdateTreatmentSessionInput,
  TreatmentEffect,
} from '@/types/treatment'

interface UseTreatmentSessionsResult {
  sessions: TreatmentSessionWithDetails[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useTreatmentSessions(
  patientId: string,
  filters: TreatmentSessionFilters = {}
): UseTreatmentSessionsResult {
  const [sessions, setSessions] = useState<TreatmentSessionWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchSessions = useCallback(async () => {
    if (!patientId) {
      setSessions([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (filters.effect && filters.effect !== 'all') params.set('effect', filters.effect)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)

      const response = await fetch(`/api/patients/${patientId}/sessions?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch sessions')
      }

      const { sessions: data } = await response.json()

      // Apply client-side search filter if needed
      let filteredSessions = data
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        filteredSessions = data.filter((s: TreatmentSessionWithDetails) =>
          s.notes?.toLowerCase().includes(searchLower) ||
          s.frequenciesUsed.some(f => f.name.toLowerCase().includes(searchLower))
        )
      }

      setSessions(filteredSessions.map((s: Record<string, unknown>) => ({
        ...s,
        createdAt: new Date(s.createdAt as string),
        updatedAt: new Date(s.updatedAt as string),
      })))
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [patientId, filters.effect, filters.startDate, filters.endDate, filters.search])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  return {
    sessions,
    isLoading,
    error,
    refetch: fetchSessions,
  }
}

// Hook for session mutations
interface UseTreatmentSessionMutationsResult {
  createSession: (patientId: string, data: CreateTreatmentSessionInput) => Promise<TreatmentSessionWithDetails>
  updateSession: (patientId: string, sessionId: string, data: UpdateTreatmentSessionInput) => Promise<TreatmentSessionWithDetails>
  deleteSession: (patientId: string, sessionId: string) => Promise<void>
  isLoading: boolean
  error: Error | null
}

export function useTreatmentSessionMutations(): UseTreatmentSessionMutationsResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const createSession = async (
    patientId: string,
    data: CreateTreatmentSessionInput
  ): Promise<TreatmentSessionWithDetails> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/patients/${patientId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create session')
      }

      const { session } = await response.json()
      return {
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const updateSession = async (
    patientId: string,
    sessionId: string,
    data: UpdateTreatmentSessionInput
  ): Promise<TreatmentSessionWithDetails> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/patients/${patientId}/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update session')
      }

      const { session } = await response.json()
      return {
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const deleteSession = async (patientId: string, sessionId: string): Promise<void> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/patients/${patientId}/sessions/${sessionId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete session')
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  return {
    createSession,
    updateSession,
    deleteSession,
    isLoading,
    error,
  }
}
