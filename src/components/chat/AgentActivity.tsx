'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { HugeiconsIcon } from '@hugeicons/react'
import { File01Icon, BookOpen01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import type { Source, AgentStep } from '@/types/chat'

interface AgentActivityProps {
  isActive: boolean
  steps: AgentStep[]
  sources: Source[]
  thinkingStartTime?: number | null
  className?: string
}

/**
 * Perplexity-style agent activity display
 * Shows working indicator, sources being reviewed, and source list
 */
export function AgentActivity({
  isActive,
  steps,
  sources,
  thinkingStartTime,
  className,
}: AgentActivityProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Update elapsed time counter
  useEffect(() => {
    if (!isActive || !thinkingStartTime) {
      setElapsedSeconds(0)
      return
    }

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - thinkingStartTime) / 1000))
    }, 100)

    return () => clearInterval(interval)
  }, [isActive, thinkingStartTime])

  // Don't render if not active and no sources
  if (!isActive && sources.length === 0) {
    return null
  }

  // Get current step label for display
  const currentStep = steps.find((s) => s.status === 'in_progress')
  const lastCompletedStep = [...steps].reverse().find((s) => s.status === 'completed')

  return (
    <div
      className={cn(
        'rounded-xl border border-neutral-200 bg-white overflow-hidden',
        isActive && 'border-brand-blue/30 shadow-sm',
        className
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center',
              isActive ? 'bg-brand-blue/10' : 'bg-neutral-100'
            )}
          >
            {isActive ? (
              <Loader2 className="w-4 h-4 text-brand-blue animate-spin" />
            ) : (
              <HugeiconsIcon
                icon={BookOpen01Icon}
                size={16}
                className="text-neutral-600"
              />
            )}
          </div>

          {/* Title and status */}
          <div className="text-left">
            <div className="text-sm font-medium text-neutral-900">
              {isActive ? (
                <span className="flex items-center gap-1.5">
                  Working
                  <span className="animate-pulse">...</span>
                </span>
              ) : (
                'Sources reviewed'
              )}
            </div>
            <div className="text-xs text-neutral-500">
              {isActive && currentStep
                ? currentStep.label
                : sources.length > 0
                  ? `${sources.length} source${sources.length !== 1 ? 's' : ''}`
                  : lastCompletedStep?.label || 'Processing'}
            </div>
          </div>
        </div>

        {/* Timer and expand toggle */}
        <div className="flex items-center gap-3">
          {isActive && elapsedSeconds > 0 && (
            <div className="text-sm font-mono text-brand-blue">{elapsedSeconds}s</div>
          )}
          {sources.length > 0 && (
            <>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-neutral-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-neutral-400" />
              )}
            </>
          )}
        </div>
      </button>

      {/* Expandable sources list */}
      <AnimatePresence>
        {isExpanded && sources.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 space-y-1.5 border-t border-neutral-100">
              <AnimatePresence mode="popLayout">
                {sources.map((source, index) => (
                  <SourceItem key={source.id} source={source} index={index} />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SourceItem({ source, index }: { source: Source; index: number }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-2.5 py-2 px-3 rounded-lg bg-neutral-50 hover:bg-neutral-100 transition-colors"
    >
      {/* Document icon */}
      <div className="flex-shrink-0 w-6 h-6 rounded bg-brand-blue/10 flex items-center justify-center">
        <HugeiconsIcon icon={File01Icon} size={14} className="text-brand-blue" />
      </div>

      {/* Source info */}
      <div className="flex-1 min-w-0">
        <span className="text-sm text-neutral-700 truncate block">{source.title}</span>
        {source.category && (
          <span className="text-xs text-neutral-400 capitalize">
            {source.category.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Body system badge */}
      {source.bodySystem && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-600 capitalize whitespace-nowrap">
          {source.bodySystem}
        </span>
      )}
    </motion.div>
  )
}
