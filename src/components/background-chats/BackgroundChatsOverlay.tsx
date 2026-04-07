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
  onReview: (_job: BackgroundJob) => void
  onCancel: (_jobId: string) => void
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
      <div className="flex items-center gap-1.5 text-white">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} />
        <span className="text-sm font-medium">Complete</span>
      </div>
    )
  }

  if (job.status === 'failed') {
    return (
      <div className="flex items-center gap-1.5 text-red-100">
        <HugeiconsIcon icon={AlertCircleIcon} size={16} />
        <span className="text-sm font-medium">Failed</span>
      </div>
    )
  }

  if (job.status === 'cancelled') {
    return (
      <div className="flex items-center gap-1.5 text-blue-100/80">
        <HugeiconsIcon icon={Cancel01Icon} size={16} />
        <span className="text-sm font-medium">Cancelled</span>
      </div>
    )
  }

  // Active job (pending, running, streaming)
  return (
    <div className="flex items-center gap-1.5 text-blue-50/90">
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
  onReview: (_job: BackgroundJob) => void
  onCancel: (_jobId: string) => void
}) {
  const isActive = ['pending', 'running', 'streaming'].includes(job.status)
  const isCompleted = job.status === 'completed'

  return (
    <div className="px-3 py-2.5 border-b border-white/15 last:border-b-0">
      {/* Title */}
      <p className="mb-1 truncate text-sm font-medium text-white">
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
              className="rounded-md p-1 text-blue-100/80 transition-colors hover:bg-white/10 hover:text-white"
              title="Cancel"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={14} />
            </button>
          )}

          {/* Review button for completed jobs */}
          {isCompleted && (
            <button
              onClick={() => onReview(job)}
              className="flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
            >
              Review
              <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Error message if failed */}
      {job.status === 'failed' && job.errorMessage && (
        <p className="mt-1 truncate text-xs text-red-100">
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
        'fixed bottom-4 right-4 z-[9999]',
        'rounded-xl border border-blue-400 bg-blue-500 text-white shadow-xl shadow-blue-900/20',
        'transition-all duration-300 ease-in-out',
        isExpanded ? 'w-80' : 'w-auto'
      )}
    >
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center gap-2.5 p-3',
          'rounded-xl transition-colors hover:bg-white/10',
          isExpanded && 'rounded-b-none border-b border-white/15'
        )}
      >
        {/* Copilot icon */}
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/15">
          <Image
            src="/icons/bfm-icon-black.svg"
            alt="Copilot"
            width={16}
            height={18}
            className="invert"
          />
        </div>

        {/* Title and counts */}
        {isExpanded ? (
          <div className="flex-1 text-left">
            <span className="text-sm font-semibold text-white">
              Background Chats
            </span>
            <div className="flex items-center gap-2 text-xs text-blue-100/80">
              {activeCount > 0 && (
                <span>{activeCount} active</span>
              )}
              {completedCount > 0 && (
                <span className="text-white">
                  {completedCount} ready
                </span>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Compact badges when collapsed */}
            {activeCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs font-medium text-white">
                {activeCount}
              </span>
            )}
            {completedCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs font-medium text-white">
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
        <div className="p-4 text-center text-sm text-blue-50/90">
          <HugeiconsIcon icon={Loading03Icon} size={20} className="animate-spin mx-auto mb-2" />
          Loading...
        </div>
      )}
    </div>
  )
}
