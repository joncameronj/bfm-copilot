'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  CheckmarkCircle02Icon,
  Cancel01Icon,
  ArrowRight01Icon,
  Loading03Icon,
  AlertCircleIcon,
} from '@hugeicons/core-free-icons'
import type { BackgroundJob } from '@/types/chat'

interface BackgroundChatsOverlayProps {
  jobs: BackgroundJob[]
  onReview: (job: BackgroundJob) => void
  onCancel: (jobId: string) => void
  isLoading?: boolean
}

// Format elapsed time as MM:SS
function formatElapsedTime(startTime: string | null): string {
  if (!startTime) return '0:00'

  const start = new Date(startTime).getTime()
  const now = Date.now()
  const elapsed = Math.floor((now - start) / 1000)

  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Get display title for a job
function getJobTitle(job: BackgroundJob): string {
  if (job.conversation?.title && job.conversation.title !== 'New Conversation') {
    return job.conversation.title
  }
  // Truncate input message as fallback
  const msg = job.inputMessage || 'Processing...'
  return msg.length > 40 ? msg.slice(0, 40) + '...' : msg
}

// Job status indicator component
function JobStatusIndicator({ job }: { job: BackgroundJob }) {
  const [elapsedTime, setElapsedTime] = useState(formatElapsedTime(job.startedAt || job.createdAt))

  // Update elapsed time every second for active jobs
  useEffect(() => {
    if (!['pending', 'running', 'streaming'].includes(job.status)) return

    const interval = setInterval(() => {
      setElapsedTime(formatElapsedTime(job.startedAt || job.createdAt))
    }, 1000)

    return () => clearInterval(interval)
  }, [job.status, job.startedAt, job.createdAt])

  if (job.status === 'completed') {
    return (
      <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} />
        <span className="text-sm font-medium">Complete</span>
      </div>
    )
  }

  if (job.status === 'failed') {
    return (
      <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
        <HugeiconsIcon icon={AlertCircleIcon} size={16} />
        <span className="text-sm font-medium">Failed</span>
      </div>
    )
  }

  if (job.status === 'cancelled') {
    return (
      <div className="flex items-center gap-1.5 text-neutral-500">
        <HugeiconsIcon icon={Cancel01Icon} size={16} />
        <span className="text-sm font-medium">Cancelled</span>
      </div>
    )
  }

  // Active job (pending, running, streaming)
  return (
    <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
      <HugeiconsIcon icon={Loading03Icon} size={16} className="animate-spin" />
      <span className="text-sm">
        {job.currentStep || 'Thinking...'} ({elapsedTime})
      </span>
    </div>
  )
}

// Individual job item component
function JobItem({
  job,
  onReview,
  onCancel,
}: {
  job: BackgroundJob
  onReview: (job: BackgroundJob) => void
  onCancel: (jobId: string) => void
}) {
  const isActive = ['pending', 'running', 'streaming'].includes(job.status)
  const isCompleted = job.status === 'completed'

  return (
    <div className="px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-700 last:border-b-0">
      {/* Title */}
      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate mb-1">
        {getJobTitle(job)}
      </p>

      {/* Status and actions */}
      <div className="flex items-center justify-between">
        <JobStatusIndicator job={job} />

        <div className="flex items-center gap-2">
          {/* Cancel button for active jobs */}
          {isActive && (
            <button
              onClick={() => onCancel(job.id)}
              className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              title="Cancel"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={14} />
            </button>
          )}

          {/* Review button for completed jobs */}
          {isCompleted && (
            <button
              onClick={() => onReview(job)}
              className="flex items-center gap-1 px-2.5 py-1 text-sm font-medium text-white bg-black dark:bg-white dark:text-black rounded-md hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
            >
              Review
              <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Error message if failed */}
      {job.status === 'failed' && job.errorMessage && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400 truncate">
          {job.errorMessage}
        </p>
      )}
    </div>
  )
}

export function BackgroundChatsOverlay({
  jobs,
  onReview,
  onCancel,
  isLoading = false,
}: BackgroundChatsOverlayProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  // Filter to only show relevant jobs (active or unread completed)
  const visibleJobs = jobs.filter(
    (job) =>
      ['pending', 'running', 'streaming'].includes(job.status) ||
      (job.status === 'completed' && !job.isRead) ||
      job.status === 'failed'
  )

  // Don't render if no jobs to show
  if (visibleJobs.length === 0 && !isLoading) {
    return null
  }

  const activeCount = visibleJobs.filter((j) =>
    ['pending', 'running', 'streaming'].includes(j.status)
  ).length
  const completedCount = visibleJobs.filter(
    (j) => j.status === 'completed' && !j.isRead
  ).length

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-[9999]',
        'bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700',
        'transition-all duration-300 ease-in-out',
        isExpanded ? 'w-80' : 'w-auto'
      )}
    >
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center gap-2.5 p-3',
          'hover:bg-neutral-50 dark:hover:bg-neutral-700/50 rounded-xl transition-colors',
          isExpanded && 'border-b border-neutral-100 dark:border-neutral-700 rounded-b-none'
        )}
      >
        {/* Copilot icon */}
        <div className="w-7 h-7 rounded-full bg-black dark:bg-white flex items-center justify-center flex-shrink-0">
          <Image
            src="/icons/bfm-icon-white.svg"
            alt="Copilot"
            width={16}
            height={18}
            className="dark:hidden"
          />
          <Image
            src="/icons/bfm-icon.svg"
            alt="Copilot"
            width={16}
            height={18}
            className="hidden dark:block"
          />
        </div>

        {/* Title and counts */}
        {isExpanded ? (
          <div className="flex-1 text-left">
            <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Background Chats
            </span>
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              {activeCount > 0 && (
                <span>{activeCount} active</span>
              )}
              {completedCount > 0 && (
                <span className="text-green-600 dark:text-green-400">
                  {completedCount} ready
                </span>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Compact badges when collapsed */}
            {activeCount > 0 && (
              <span className="flex items-center justify-center w-5 h-5 text-xs font-medium bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-200 rounded-full">
                {activeCount}
              </span>
            )}
            {completedCount > 0 && (
              <span className="flex items-center justify-center w-5 h-5 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full">
                {completedCount}
              </span>
            )}
          </>
        )}
      </button>

      {/* Job list - expanded */}
      {isExpanded && visibleJobs.length > 0 && (
        <div className="max-h-80 overflow-y-auto">
          {visibleJobs.map((job) => (
            <JobItem
              key={job.id}
              job={job}
              onReview={onReview}
              onCancel={onCancel}
            />
          ))}
        </div>
      )}

      {/* Loading state */}
      {isExpanded && isLoading && visibleJobs.length === 0 && (
        <div className="p-4 text-center text-sm text-neutral-500">
          <HugeiconsIcon icon={Loading03Icon} size={20} className="animate-spin mx-auto mb-2" />
          Loading...
        </div>
      )}
    </div>
  )
}
