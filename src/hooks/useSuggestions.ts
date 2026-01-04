'use client'

import { useState, useEffect, useCallback } from 'react'

interface Suggestion {
  id: string
  userId: string
  conversationId?: string | null
  content: string
  category?: string | null
  status: 'pending' | 'accepted' | 'rejected' | 'superseded'
  sourceContext?: string | null
  parentSuggestionId?: string | null
  iterationCount: number
  createdAt: string
  updatedAt: string
}

type FeedbackRating = 'thumbs_up' | 'thumbs_down'

interface UseSuggestionsOptions {
  limit?: number
  category?: string
  status?: string
}

interface UseSuggestionsReturn {
  suggestions: Suggestion[]
  isLoading: boolean
  error: string | null
  submitFeedback: (id: string, rating: FeedbackRating, feedbackText?: string) => Promise<void>
  refreshSuggestions: () => Promise<void>
}

export function useSuggestions(
  options: UseSuggestionsOptions = {}
): UseSuggestionsReturn {
  const { limit = 50, category, status } = options

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSuggestions = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams()
      params.set('limit', limit.toString())
      if (category) params.set('category', category)
      if (status) params.set('status', status)

      const response = await fetch(`/api/suggestions?${params}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch suggestions (${response.status})`)
      }

      const data = await response.json()
      setSuggestions(data.suggestions || [])
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load suggestions'
      setError(errorMessage)
      console.error('Error fetching suggestions:', err)
    } finally {
      setIsLoading(false)
    }
  }, [limit, category, status])

  // Initial fetch
  useEffect(() => {
    fetchSuggestions()
  }, [fetchSuggestions])

  const submitFeedback = useCallback(
    async (id: string, rating: FeedbackRating, feedbackText?: string): Promise<void> => {
      try {
        setError(null)

        // Optimistically update status
        const newStatus = rating === 'thumbs_up' ? 'accepted' : 'rejected'
        setSuggestions((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, status: newStatus as Suggestion['status'] } : s
          )
        )

        const response = await fetch(`/api/suggestions/${id}/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating, feedbackText }),
        })

        if (!response.ok) {
          // Revert on failure
          setSuggestions((prev) =>
            prev.map((s) =>
              s.id === id ? { ...s, status: 'pending' } : s
            )
          )
          throw new Error('Failed to submit feedback')
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to submit feedback'
        setError(errorMessage)
        console.error('Error submitting feedback:', err)
      }
    },
    []
  )

  const refreshSuggestions = useCallback(async (): Promise<void> => {
    await fetchSuggestions()
  }, [fetchSuggestions])

  return {
    suggestions,
    isLoading,
    error,
    submitFeedback,
    refreshSuggestions,
  }
}
