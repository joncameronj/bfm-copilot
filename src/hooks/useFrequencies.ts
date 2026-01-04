'use client'

import { useState, useEffect, useCallback } from 'react'
import type { FSMFrequency } from '@/types/treatment'

interface UseFrequenciesResult {
  frequencies: FSMFrequency[]
  categories: string[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

interface UseFrequenciesOptions {
  category?: string
  search?: string
  activeOnly?: boolean
}

export function useFrequencies(options: UseFrequenciesOptions = {}): UseFrequenciesResult {
  const [frequencies, setFrequencies] = useState<FSMFrequency[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchFrequencies = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (options.category && options.category !== 'all') params.set('category', options.category)
      if (options.search) params.set('search', options.search)
      if (options.activeOnly === false) params.set('activeOnly', 'false')

      const response = await fetch(`/api/frequencies?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch frequencies')
      }

      const data = await response.json()

      setFrequencies(data.frequencies.map((f: Record<string, unknown>) => ({
        ...f,
        createdAt: new Date(f.createdAt as string),
        updatedAt: new Date(f.updatedAt as string),
      })))
      setCategories(data.categories || [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [options.category, options.search, options.activeOnly])

  useEffect(() => {
    fetchFrequencies()
  }, [fetchFrequencies])

  return {
    frequencies,
    categories,
    isLoading,
    error,
    refetch: fetchFrequencies,
  }
}

// Hook for selecting frequencies (for forms)
interface UseFrequencySelectorResult {
  frequencies: FSMFrequency[]
  selectedFrequencies: FSMFrequency[]
  categories: string[]
  isLoading: boolean
  toggleFrequency: (frequency: FSMFrequency) => void
  selectFrequency: (frequency: FSMFrequency) => void
  removeFrequency: (frequencyId: string) => void
  clearSelection: () => void
  setSelection: (frequencies: FSMFrequency[]) => void
}

export function useFrequencySelector(
  initialSelection: FSMFrequency[] = []
): UseFrequencySelectorResult {
  const { frequencies, categories, isLoading } = useFrequencies()
  const [selectedFrequencies, setSelectedFrequencies] = useState<FSMFrequency[]>(initialSelection)

  const toggleFrequency = useCallback((frequency: FSMFrequency) => {
    setSelectedFrequencies((prev) => {
      const exists = prev.some((f) => f.id === frequency.id)
      if (exists) {
        return prev.filter((f) => f.id !== frequency.id)
      }
      return [...prev, frequency]
    })
  }, [])

  const selectFrequency = useCallback((frequency: FSMFrequency) => {
    setSelectedFrequencies((prev) => {
      if (prev.some((f) => f.id === frequency.id)) return prev
      return [...prev, frequency]
    })
  }, [])

  const removeFrequency = useCallback((frequencyId: string) => {
    setSelectedFrequencies((prev) => prev.filter((f) => f.id !== frequencyId))
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedFrequencies([])
  }, [])

  const setSelection = useCallback((frequencies: FSMFrequency[]) => {
    setSelectedFrequencies(frequencies)
  }, [])

  return {
    frequencies,
    selectedFrequencies,
    categories,
    isLoading,
    toggleFrequency,
    selectFrequency,
    removeFrequency,
    clearSelection,
    setSelection,
  }
}
