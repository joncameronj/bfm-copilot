'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useBackgroundJobs } from '@/hooks/useBackgroundJobs'
import type { BackgroundJob } from '@/types/chat'

interface BackgroundJobsContextType {
  jobs: BackgroundJob[]
  unreadCount: number
  activeCount: number
  isLoading: boolean
  error: string | null
  startBackgroundJob: (conversationId: string, message: string, context?: Record<string, unknown>) => Promise<string | null>
  markAsRead: (jobId: string) => Promise<void>
  cancelJob: (jobId: string) => Promise<void>
  reviewJob: (job: BackgroundJob) => void
  refreshJobs: () => Promise<void>
  canStartNewJob: boolean
  getJobsForConversation: (conversationId: string) => BackgroundJob[]
}

const BackgroundJobsContext = createContext<BackgroundJobsContextType | undefined>(undefined)

interface BackgroundJobsProviderProps {
  children: ReactNode
  userId: string | undefined
}

export function BackgroundJobsProvider({ children, userId }: BackgroundJobsProviderProps) {
  const backgroundJobs = useBackgroundJobs({
    userId,
    enabled: !!userId,
  })

  return (
    <BackgroundJobsContext.Provider value={backgroundJobs}>
      {children}
    </BackgroundJobsContext.Provider>
  )
}

export function useBackgroundJobsContext() {
  const context = useContext(BackgroundJobsContext)
  if (context === undefined) {
    throw new Error('useBackgroundJobsContext must be used within a BackgroundJobsProvider')
  }
  return context
}

// Optional hook that returns undefined outside of provider (for components that may be used both inside and outside provider)
export function useBackgroundJobsOptional() {
  return useContext(BackgroundJobsContext)
}
