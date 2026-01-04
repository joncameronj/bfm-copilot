'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ReasoningData } from '@/types/chat'

interface ReasoningDisplayProps {
  isReasoning: boolean
  reasoning: ReasoningData | null
  isExpanded?: boolean
  onToggle?: () => void
}

export function ReasoningDisplay({
  isReasoning,
  reasoning,
  isExpanded = false,
  onToggle,
}: ReasoningDisplayProps) {
  const [localExpanded, setLocalExpanded] = useState(isExpanded)
  const [displayedElapsed, setDisplayedElapsed] = useState(0)

  // Update elapsed time in real-time when reasoning is active
  useEffect(() => {
    if (isReasoning && reasoning?.elapsedMs !== undefined) {
      setDisplayedElapsed(reasoning.elapsedMs)
    }
  }, [isReasoning, reasoning?.elapsedMs])

  // Animate elapsed counter when reasoning
  useEffect(() => {
    if (!isReasoning) return

    const interval = setInterval(() => {
      setDisplayedElapsed((prev) => prev + 100)
    }, 100)

    return () => clearInterval(interval)
  }, [isReasoning])

  const handleToggle = () => {
    if (onToggle) {
      onToggle()
    } else {
      setLocalExpanded(!localExpanded)
    }
  }

  const expanded = onToggle !== undefined ? isExpanded : localExpanded

  // Don't render if there's no reasoning and we're not actively reasoning
  if (!isReasoning && !reasoning?.text) {
    return null
  }

  const formatElapsed = (ms: number) => {
    const seconds = (ms / 1000).toFixed(1)
    return `${seconds}s`
  }

  return (
    <div className="mb-3">
      {/* Reasoning header */}
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        {/* Brain/thinking icon */}
        <svg
          className={`w-4 h-4 ${isReasoning ? 'animate-pulse text-blue-500' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>

        <span className="font-medium">
          {isReasoning ? 'Thinking...' : 'Thought process'}
        </span>

        {/* Elapsed time */}
        <span className="text-xs text-gray-400 tabular-nums">
          {formatElapsed(isReasoning ? displayedElapsed : reasoning?.elapsedMs || 0)}
        </span>

        {/* Expand/collapse arrow */}
        <svg
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Reasoning content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pl-6 border-l-2 border-gray-200">
              {/* Reasoning summary (if available) */}
              {reasoning?.summary && (
                <div className="mb-2 p-2 bg-blue-50 rounded text-sm text-blue-800">
                  <span className="font-medium">Summary: </span>
                  {reasoning.summary}
                </div>
              )}

              {/* Full reasoning text */}
              <div className="text-sm text-gray-600 whitespace-pre-wrap max-h-60 overflow-y-auto">
                {reasoning?.text || (
                  <span className="text-gray-400 italic">
                    {isReasoning ? 'Processing...' : 'No reasoning data available'}
                  </span>
                )}
                {isReasoning && (
                  <motion.span
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="inline-block ml-1"
                  >
                    |
                  </motion.span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Compact version for inline display
export function ReasoningIndicator({
  isReasoning,
  elapsedMs,
}: {
  isReasoning: boolean
  elapsedMs: number
}) {
  const [displayed, setDisplayed] = useState(elapsedMs)

  useEffect(() => {
    if (!isReasoning) {
      setDisplayed(elapsedMs)
      return
    }

    const interval = setInterval(() => {
      setDisplayed((prev) => prev + 100)
    }, 100)

    return () => clearInterval(interval)
  }, [isReasoning, elapsedMs])

  if (!isReasoning) return null

  return (
    <div className="flex items-center gap-2 text-sm text-blue-500">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </motion.div>
      <span>Thinking... {(displayed / 1000).toFixed(1)}s</span>
    </div>
  )
}
