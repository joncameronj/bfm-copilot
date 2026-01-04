'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, AlertCircle, ChevronDown, ChevronUp, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentStep } from '@/types/chat'

interface AgentStepsProps {
  steps: AgentStep[]
  isActive?: boolean
  thinkingStartTime?: number | null
  className?: string
}

/**
 * Displays agent thinking steps with status indicators
 * Shows expandable list with checkmarks, spinners, and timing
 */
export function AgentSteps({
  steps,
  isActive = false,
  thinkingStartTime,
  className,
}: AgentStepsProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Update elapsed time counter
  useEffect(() => {
    if (!isActive || !thinkingStartTime) {
      return
    }

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - thinkingStartTime) / 1000))
    }, 100)

    return () => clearInterval(interval)
  }, [isActive, thinkingStartTime])

  // Calculate total thinking time when complete
  const totalSeconds = isActive
    ? elapsedSeconds
    : steps.length > 0
      ? Math.floor(
          ((steps[steps.length - 1]?.endTime || Date.now()) -
            (steps[0]?.startTime || Date.now())) /
            1000
        )
      : 0

  if (steps.length === 0 && !isActive) {
    return null
  }

  const completedCount = steps.filter((s) => s.status === 'completed').length
  const hasErrors = steps.some((s) => s.status === 'error')

  return (
    <div
      className={cn(
        'rounded-xl border border-neutral-200 bg-white overflow-hidden',
        isActive && 'border-brand-blue/30 shadow-sm',
        className
      )}
    >
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center',
              isActive
                ? 'bg-brand-blue/10'
                : hasErrors
                  ? 'bg-red-100'
                  : 'bg-green-100'
            )}
          >
            {isActive ? (
              <Brain className="w-4 h-4 text-brand-blue animate-pulse" />
            ) : hasErrors ? (
              <AlertCircle className="w-4 h-4 text-red-500" />
            ) : (
              <Check className="w-4 h-4 text-green-600" />
            )}
          </div>

          {/* Title and stats */}
          <div className="text-left">
            <div className="text-sm font-medium text-neutral-900">
              {isActive ? 'Thinking...' : `Thought for ${totalSeconds}s`}
            </div>
            <div className="text-xs text-neutral-500">
              {isActive
                ? `${steps.length} step${steps.length !== 1 ? 's' : ''}`
                : `${completedCount}/${steps.length} steps completed`}
            </div>
          </div>
        </div>

        {/* Timer and expand toggle */}
        <div className="flex items-center gap-3">
          {isActive && (
            <div className="text-sm font-mono text-brand-blue">
              {formatTime(elapsedSeconds)}
            </div>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          )}
        </div>
      </button>

      {/* Expandable step list */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 space-y-2 border-t border-neutral-100">
              <AnimatePresence mode="popLayout">
                {steps.map((step, index) => (
                  <StepItem key={step.id} step={step} index={index} />
                ))}
              </AnimatePresence>

              {/* Active shimmer placeholder for next step */}
              {isActive && steps.every((s) => s.status === 'completed') && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg bg-neutral-50"
                >
                  <div className="w-5 h-5 rounded-full bg-neutral-200 animate-pulse" />
                  <div className="h-3 bg-neutral-200 rounded animate-pulse flex-1 max-w-32" />
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StepItem({ step, index }: { step: AgentStep; index: number }) {
  const duration =
    step.startTime && step.endTime
      ? Math.round((step.endTime - step.startTime) / 1000)
      : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'flex items-center gap-3 py-2 px-3 rounded-lg transition-colors',
        step.status === 'in_progress' && 'bg-brand-blue/5',
        step.status === 'completed' && 'bg-neutral-50',
        step.status === 'error' && 'bg-red-50'
      )}
    >
      {/* Status icon */}
      <div className="flex-shrink-0">
        {step.status === 'in_progress' && (
          <Loader2 className="w-5 h-5 text-brand-blue animate-spin" />
        )}
        {step.status === 'completed' && (
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}
        {step.status === 'error' && (
          <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
            <AlertCircle className="w-3 h-3 text-white" />
          </div>
        )}
        {step.status === 'pending' && (
          <div className="w-5 h-5 rounded-full bg-neutral-200" />
        )}
      </div>

      {/* Step label */}
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            'text-sm',
            step.status === 'in_progress' && 'text-brand-blue font-medium',
            step.status === 'completed' && 'text-neutral-600',
            step.status === 'error' && 'text-red-600',
            step.status === 'pending' && 'text-neutral-400'
          )}
        >
          {step.label}
        </span>
        {step.error && (
          <p className="text-xs text-red-500 mt-0.5 truncate">{step.error}</p>
        )}
      </div>

      {/* Duration */}
      {duration !== null && step.status === 'completed' && (
        <span className="text-xs text-neutral-400 font-mono">{duration}s</span>
      )}
    </motion.div>
  )
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  return `${secs}s`
}
