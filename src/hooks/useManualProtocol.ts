'use client'

import { useState, useCallback } from 'react'
import type { ApprovedFrequency, ManualProtocolInput, TreatmentSessionResponse } from '@/types/frequency'

interface UseManualProtocolResult {
  selectedFrequencies: ApprovedFrequency[]
  toggleFrequency: (frequency: ApprovedFrequency) => void
  clearSelection: () => void
  createSession: (input: Omit<ManualProtocolInput, 'frequencyIds'>) => Promise<TreatmentSessionResponse>
  isLoading: boolean
  error: Error | null
}

/**
 * Hook to manage manual protocol selection and creation
 */
export function useManualProtocol(): UseManualProtocolResult {
  const [selectedFrequencies, setSelectedFrequencies] = useState<ApprovedFrequency[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const toggleFrequency = useCallback((frequency: ApprovedFrequency) => {
    setSelectedFrequencies((prev) => {
      const exists = prev.some((f) => f.id === frequency.id)
      if (exists) {
        return prev.filter((f) => f.id !== frequency.id)
      } else {
        return [...prev, frequency]
      }
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedFrequencies([])
  }, [])

  const createSession = useCallback(
    async (input: Omit<ManualProtocolInput, 'frequencyIds'>): Promise<TreatmentSessionResponse> => {
      if (selectedFrequencies.length === 0) {
        throw new Error('No frequencies selected')
      }

      setIsLoading(true)
      setError(null)

      try {
        const requestBody: ManualProtocolInput = {
          ...input,
          frequencyIds: selectedFrequencies.map((f) => f.id),
        }

        const response = await fetch('/api/treatment-sessions/manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to create treatment session')
        }

        const data = await response.json()
        setSelectedFrequencies([]) // Clear selection on success
        return data.session
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError(error)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [selectedFrequencies]
  )

  return {
    selectedFrequencies,
    toggleFrequency,
    clearSelection,
    createSession,
    isLoading,
    error,
  }
}
