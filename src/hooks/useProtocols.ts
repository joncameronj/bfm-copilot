'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  ProtocolWithFeedback,
  ProtocolFilters,
  CreateProtocolInput,
  UpdateProtocolInput,
  SubmitFeedbackInput,
  ProtocolApiResponse,
  apiToProtocol,
} from '@/types/protocol'

interface UseProtocolsResult {
  protocols: ProtocolWithFeedback[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useProtocols(filters: ProtocolFilters): UseProtocolsResult {
  const [protocols, setProtocols] = useState<ProtocolWithFeedback[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchProtocols = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (filters.status && filters.status !== 'all') params.set('status', filters.status)
      if (filters.category && filters.category !== 'all') params.set('category', filters.category)
      if (filters.patientId) params.set('patientId', filters.patientId)

      const response = await fetch(`/api/protocols?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch protocols')
      }

      const { protocols: data } = await response.json()

      // Convert API responses to Protocol types
      const transformedProtocols = data.map((p: ProtocolApiResponse) => ({
        id: p.id,
        practitionerId: p.practitionerId,
        patientId: p.patientId,
        patient: p.patient,
        title: p.title,
        content: p.content,
        category: p.category,
        status: p.status,
        durationDays: p.durationDays,
        startDate: p.startDate,
        endDate: p.endDate,
        notes: p.notes,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
        feedback: p.feedback?.map(f => ({
          id: f.id,
          protocolId: p.id,
          practitionerId: p.practitionerId,
          outcome: f.outcome,
          outcomeText: f.outcomeText,
          rating: f.rating,
          createdAt: new Date(f.createdAt),
        })) || [],
      }))

      // Apply client-side search filter if needed
      let filteredProtocols = transformedProtocols
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        filteredProtocols = transformedProtocols.filter((p: ProtocolWithFeedback) =>
          p.title.toLowerCase().includes(searchLower) ||
          p.patient?.firstName.toLowerCase().includes(searchLower) ||
          p.patient?.lastName.toLowerCase().includes(searchLower)
        )
      }

      setProtocols(filteredProtocols)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [filters.status, filters.category, filters.patientId, filters.search])

  useEffect(() => {
    fetchProtocols()
  }, [fetchProtocols])

  return {
    protocols,
    isLoading,
    error,
    refetch: fetchProtocols,
  }
}

// Hook for single protocol
interface UseProtocolResult {
  protocol: ProtocolWithFeedback | null
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useProtocol(protocolId: string | null): UseProtocolResult {
  const [protocol, setProtocol] = useState<ProtocolWithFeedback | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchProtocol = useCallback(async () => {
    if (!protocolId) {
      setProtocol(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/protocols/${protocolId}`)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Protocol not found')
        }
        throw new Error('Failed to fetch protocol')
      }

      const { protocol: data } = await response.json()

      setProtocol({
        id: data.id,
        practitionerId: data.practitionerId,
        patientId: data.patientId,
        patient: data.patient,
        title: data.title,
        content: data.content,
        category: data.category,
        status: data.status,
        durationDays: data.durationDays,
        startDate: data.startDate,
        endDate: data.endDate,
        notes: data.notes,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
        feedback: data.feedback?.map((f: { id: string; outcome: string; outcomeText?: string; adjustmentsMade?: string; rating?: string; labComparison?: string; createdAt: string }) => ({
          id: f.id,
          protocolId: data.id,
          practitionerId: data.practitionerId,
          outcome: f.outcome,
          outcomeText: f.outcomeText,
          adjustmentsMade: f.adjustmentsMade,
          rating: f.rating,
          labComparison: f.labComparison,
          createdAt: new Date(f.createdAt),
        })) || [],
      })
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [protocolId])

  useEffect(() => {
    fetchProtocol()
  }, [fetchProtocol])

  return {
    protocol,
    isLoading,
    error,
    refetch: fetchProtocol,
  }
}

// Hook for protocol mutations
interface UseProtocolMutationsResult {
  createProtocol: (data: CreateProtocolInput) => Promise<ProtocolWithFeedback>
  updateProtocol: (id: string, data: UpdateProtocolInput) => Promise<ProtocolWithFeedback>
  deleteProtocol: (id: string) => Promise<void>
  submitFeedback: (protocolId: string, feedback: SubmitFeedbackInput) => Promise<void>
  isLoading: boolean
  error: Error | null
}

export function useProtocolMutations(): UseProtocolMutationsResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const createProtocol = async (data: CreateProtocolInput): Promise<ProtocolWithFeedback> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/protocols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create protocol')
      }

      const { protocol } = await response.json()
      return {
        ...protocol,
        createdAt: new Date(protocol.createdAt),
        updatedAt: new Date(protocol.updatedAt),
        feedback: [],
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const updateProtocol = async (id: string, data: UpdateProtocolInput): Promise<ProtocolWithFeedback> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/protocols/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update protocol')
      }

      const { protocol } = await response.json()
      return {
        ...protocol,
        createdAt: new Date(protocol.createdAt),
        updatedAt: new Date(protocol.updatedAt),
        feedback: protocol.feedback?.map((f: { id: string; outcome: string; outcomeText?: string; rating?: string; createdAt: string }) => ({
          ...f,
          createdAt: new Date(f.createdAt),
        })) || [],
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const deleteProtocol = async (id: string): Promise<void> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/protocols/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete protocol')
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const submitFeedback = async (protocolId: string, feedback: SubmitFeedbackInput): Promise<void> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/protocols/${protocolId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedback),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit feedback')
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
    createProtocol,
    updateProtocol,
    deleteProtocol,
    submitFeedback,
    isLoading,
    error,
  }
}
