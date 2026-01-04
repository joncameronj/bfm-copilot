'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Conversation } from '@/types/shared'

interface UseConversationsOptions {
  limit?: number
  patientId?: string
}

interface UseConversationsReturn {
  conversations: Conversation[]
  isLoading: boolean
  error: string | null
  createConversation: (
    title?: string,
    patientId?: string
  ) => Promise<Conversation | null>
  renameConversation: (id: string, title: string) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  starConversation: (id: string, isStarred: boolean) => Promise<void>
  archiveConversation: (id: string, isArchived: boolean) => Promise<void>
  refreshConversations: () => Promise<void>
}

export function useConversations(
  options: UseConversationsOptions = {}
): UseConversationsReturn {
  const { limit = 50, patientId } = options

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchConversations = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams()
      params.set('limit', limit.toString())
      if (patientId) params.set('patientId', patientId)

      const response = await fetch(`/api/conversations?${params}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Conversations API error:', response.status, errorData)
        throw new Error(errorData.error || `Failed to fetch conversations (${response.status})`)
      }

      const data = await response.json()
      setConversations(data.conversations || [])
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load conversations'
      setError(errorMessage)
      console.error('Error fetching conversations:', err)
    } finally {
      setIsLoading(false)
    }
  }, [limit, patientId])

  // Initial fetch
  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  const createConversation = useCallback(
    async (title?: string, patientIdOverride?: string): Promise<Conversation | null> => {
      try {
        setError(null)

        const response = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title || 'New Conversation',
            patientId: patientIdOverride || patientId,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to create conversation')
        }

        const data = await response.json()
        const newConversation = data.conversation

        // Add to the beginning of the list
        setConversations((prev) => [newConversation, ...prev])

        return newConversation
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to create conversation'
        setError(errorMessage)
        console.error('Error creating conversation:', err)
        return null
      }
    },
    [patientId]
  )

  const renameConversation = useCallback(
    async (id: string, title: string): Promise<void> => {
      try {
        setError(null)

        const response = await fetch(`/api/conversations/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        })

        if (!response.ok) {
          throw new Error('Failed to rename conversation')
        }

        // Update locally
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === id ? { ...conv, title, updatedAt: new Date() } : conv
          )
        )
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to rename conversation'
        setError(errorMessage)
        console.error('Error renaming conversation:', err)
      }
    },
    []
  )

  const deleteConversation = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null)

      const response = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete conversation')
      }

      // Remove from local state
      setConversations((prev) => prev.filter((conv) => conv.id !== id))
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to delete conversation'
      setError(errorMessage)
      console.error('Error deleting conversation:', err)
    }
  }, [])

  const starConversation = useCallback(
    async (id: string, isStarred: boolean): Promise<void> => {
      try {
        setError(null)

        // Optimistically update local state
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === id ? { ...conv, isStarred } : conv
          )
        )

        const response = await fetch(`/api/conversations/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isStarred }),
        })

        if (!response.ok) {
          // Revert on failure
          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === id ? { ...conv, isStarred: !isStarred } : conv
            )
          )
          throw new Error('Failed to star conversation')
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to star conversation'
        setError(errorMessage)
        console.error('Error starring conversation:', err)
      }
    },
    []
  )

  const archiveConversation = useCallback(
    async (id: string, isArchived: boolean): Promise<void> => {
      try {
        setError(null)

        // Optimistically remove from list when archiving
        if (isArchived) {
          setConversations((prev) => prev.filter((conv) => conv.id !== id))
        }

        const response = await fetch(`/api/conversations/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isArchived }),
        })

        if (!response.ok) {
          // Refresh on failure to restore state
          await fetchConversations()
          throw new Error('Failed to archive conversation')
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to archive conversation'
        setError(errorMessage)
        console.error('Error archiving conversation:', err)
      }
    },
    [fetchConversations]
  )

  const refreshConversations = useCallback(async (): Promise<void> => {
    await fetchConversations()
  }, [fetchConversations])

  return {
    conversations,
    isLoading,
    error,
    createConversation,
    renameConversation,
    deleteConversation,
    starConversation,
    archiveConversation,
    refreshConversations,
  }
}
