'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ApprovedFrequency, FrequencyFilters } from '@/types/frequency'

interface UseApprovedFrequenciesResult {
  frequencies: ApprovedFrequency[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Hook to fetch and filter approved frequencies
 */
export function useApprovedFrequencies(filters: FrequencyFilters): UseApprovedFrequenciesResult {
  const [frequencies, setFrequencies] = useState<ApprovedFrequency[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchFrequencies = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()

      if (filters.category && filters.category !== 'all') {
        params.set('category', filters.category)
      }

      if (filters.search) {
        params.set('search', filters.search)
      }

      if (filters.isActive !== undefined) {
        params.set('isActive', String(filters.isActive))
      }

      if (filters.limit) {
        params.set('limit', String(filters.limit))
      }

      const response = await fetch(`/api/approved-frequencies?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch approved frequencies')
      }

      const data = await response.json()
      setFrequencies(data.frequencies || [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [filters.category, filters.search, filters.isActive, filters.limit])

  useEffect(() => {
    fetchFrequencies()
  }, [fetchFrequencies])

  return {
    frequencies,
    isLoading,
    error,
    refetch: fetchFrequencies,
  }
}
