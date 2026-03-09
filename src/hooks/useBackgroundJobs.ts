'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { BackgroundJob, BackgroundJobStatus } from '@/types/chat'

// Maximum concurrent background jobs
const MAX_CONCURRENT_JOBS = 3

interface UseBackgroundJobsOptions {
  userId?: string
  enabled?: boolean
}

interface UseBackgroundJobsReturn {
  jobs: BackgroundJob[]
  unreadCount: number
  activeCount: number
  isLoading: boolean
  error: string | null
  // Actions
  startBackgroundJob: (conversationId: string, message: string, context?: Record<string, unknown>) => Promise<string | null>
  markAsRead: (jobId: string) => Promise<void>
  cancelJob: (jobId: string) => Promise<void>
  reviewJob: (job: BackgroundJob) => void
  refreshJobs: () => Promise<void>
  // Helpers
  canStartNewJob: boolean
  getJobsForConversation: (conversationId: string) => BackgroundJob[]
}

function isNetworkFetchError(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false
  const message = error.message.toLowerCase()
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed')
  )
}

// Transform snake_case database fields to camelCase
function transformJob(dbJob: Record<string, unknown>): BackgroundJob {
  const conversation = dbJob.conversations as Record<string, unknown> | null
  return {
    id: (dbJob.id as string) || '',
    conversationId: (dbJob.conversation_id as string) || '',
    userId: (dbJob.user_id as string) || '',
    status: (dbJob.status as BackgroundJobStatus) || 'pending',
    inputMessage: (dbJob.input_message as string) || '',
    outputContent: (dbJob.output_content as string) || null,
    outputReasoning: (dbJob.output_reasoning as string) || null,
    outputMetadata: (dbJob.output_metadata as Record<string, unknown>) || null,
    currentStep: (dbJob.current_step as string) || null,
    errorMessage: (dbJob.error_message as string) || null,
    isRead: (dbJob.is_read as boolean) ?? false,
    createdAt: (dbJob.created_at as string) || new Date().toISOString(),
    startedAt: (dbJob.started_at as string) || null,
    completedAt: (dbJob.completed_at as string) || null,
    conversation: conversation ? {
      id: (conversation.id as string) || '',
      title: (conversation.title as string) || 'New Conversation',
      patientId: (conversation.patient_id as string) || null,
    } : undefined,
  }
}

export function useBackgroundJobs(options: UseBackgroundJobsOptions = {}): UseBackgroundJobsReturn {
  const { userId, enabled = true } = options
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [jobs, setJobs] = useState<BackgroundJob[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [activeCount, setActiveCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Track subscription
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Fetch jobs from API
  const refreshJobs = useCallback(async () => {
    if (!userId) return

    try {
      const response = await fetch('/api/jobs')

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('[BackgroundJobs] API error:', response.status, errorData)
        // If table doesn't exist yet, just return empty - this is expected before migration runs
        if (errorData.error?.includes('relation') || errorData.error?.includes('does not exist')) {
          console.log('[BackgroundJobs] Table not yet created, skipping fetch')
          setJobs([])
          setUnreadCount(0)
          setActiveCount(0)
          setIsLoading(false)
          return
        }
        throw new Error(errorData.error || `Failed to fetch jobs (${response.status})`)
      }

      const data = await response.json()
      setJobs((data.jobs || []).map(transformJob))
      setUnreadCount(data.unreadCount || 0)
      setActiveCount(data.activeCount || 0)
      setError(null)
    } catch (err) {
      if (isNetworkFetchError(err)) {
        console.warn('[BackgroundJobs] /api/jobs unavailable; skipping refresh')
      } else {
        console.error('Failed to fetch background jobs:', err)
      }
      // Don't show error to user for background jobs - just silently fail
      // This feature is optional and shouldn't block the main UI
      setJobs([])
      setUnreadCount(0)
      setActiveCount(0)
      setError(null) // Don't surface this error to users
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  // Set up Supabase Realtime subscription for job updates
  useEffect(() => {
    if (!enabled || !userId) return

    // Initial fetch
    refreshJobs()

    // Subscribe to changes on agent_jobs table for this user
    const channel = supabase
      .channel(`agent_jobs:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_jobs',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[BackgroundJobs] Realtime update:', payload.eventType, payload)

          if (payload.eventType === 'INSERT') {
            // New job created
            const newJob = transformJob(payload.new)
            setJobs(prev => [newJob, ...prev])
            setActiveCount(prev => prev + 1)
          } else if (payload.eventType === 'UPDATE') {
            // Job updated
            const updatedJob = transformJob(payload.new)
            setJobs(prev => prev.map(job =>
              job.id === updatedJob.id ? updatedJob : job
            ))

            // Update counts based on status change
            const oldStatus = (payload.old as Record<string, unknown>)?.status as BackgroundJobStatus
            const newStatus = updatedJob.status

            if (oldStatus !== newStatus) {
              const wasActive = ['pending', 'running', 'streaming'].includes(oldStatus)
              const isActive = ['pending', 'running', 'streaming'].includes(newStatus)

              if (wasActive && !isActive) {
                setActiveCount(prev => Math.max(0, prev - 1))
              } else if (!wasActive && isActive) {
                setActiveCount(prev => prev + 1)
              }

              // Update unread count when job completes
              if (newStatus === 'completed' && !updatedJob.isRead) {
                setUnreadCount(prev => prev + 1)
              }
            }

            // Handle read status change
            if (payload.old && (payload.old as Record<string, unknown>).is_read === false && updatedJob.isRead) {
              setUnreadCount(prev => Math.max(0, prev - 1))
            }
          } else if (payload.eventType === 'DELETE') {
            // Job deleted
            const deletedId = (payload.old as Record<string, unknown>).id as string
            setJobs(prev => {
              const deletedJob = prev.find(job => job.id === deletedId)

              if (deletedJob) {
                if (['pending', 'running', 'streaming'].includes(deletedJob.status)) {
                  setActiveCount(active => Math.max(0, active - 1))
                }
                if (deletedJob.status === 'completed' && !deletedJob.isRead) {
                  setUnreadCount(unread => Math.max(0, unread - 1))
                }
              }

              return prev.filter(job => job.id !== deletedId)
            })
          }
        }
      )
      .subscribe()

    subscriptionRef.current = channel

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
        subscriptionRef.current = null
      }
    }
  }, [enabled, userId, supabase, refreshJobs])

  // Start a new background job
  const startBackgroundJob = useCallback(async (
    conversationId: string,
    message: string,
    context?: Record<string, unknown>
  ): Promise<string | null> => {
    if (!userId) {
      setError('User not authenticated')
      return null
    }

    if (activeCount >= MAX_CONCURRENT_JOBS) {
      setError(`Maximum ${MAX_CONCURRENT_JOBS} concurrent jobs reached`)
      return null
    }

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          userId,
          message,
          context,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create job')
      }

      const data = await response.json()
      setError(null)
      return data.jobId
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start background job'
      setError(message)
      console.error('Failed to start background job:', err)
      return null
    }
  }, [userId, activeCount])

  // Mark a job as read
  const markAsRead = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/mark-read`, {
        method: 'POST',
      })

      if (!response.ok) throw new Error('Failed to mark job as read')

      // Optimistic update
      setJobs(prev => prev.map(job =>
        job.id === jobId ? { ...job, isRead: true } : job
      ))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Failed to mark job as read:', err)
    }
  }, [])

  // Cancel a job
  const cancelJob = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/cancel`, {
        method: 'POST',
      })

      if (!response.ok) throw new Error('Failed to cancel job')

      // Optimistic update
      setJobs(prev => prev.map(job =>
        job.id === jobId ? { ...job, status: 'cancelled' as BackgroundJobStatus } : job
      ))
      setActiveCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Failed to cancel job:', err)
    }
  }, [])

  // Review a completed job (navigate to conversation)
  const reviewJob = useCallback((job: BackgroundJob) => {
    // Mark as read if not already
    if (!job.isRead) {
      markAsRead(job.id)
    }

    // Navigate to the conversation
    router.push(`/?conversation=${job.conversationId}`)
  }, [markAsRead, router])

  // Get jobs for a specific conversation
  const getJobsForConversation = useCallback((conversationId: string) => {
    return jobs.filter(job => job.conversationId === conversationId)
  }, [jobs])

  return {
    jobs,
    unreadCount,
    activeCount,
    isLoading,
    error,
    startBackgroundJob,
    markAsRead,
    cancelJob,
    reviewJob,
    refreshJobs,
    canStartNewJob: activeCount < MAX_CONCURRENT_JOBS,
    getJobsForConversation,
  }
}
