'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { HugeiconsIcon } from '@hugeicons/react'
import { File01Icon, BookOpen01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import type { Source } from '@/types/chat'

interface SourcesListProps {
  sources: Source[]
  isActive: boolean
  className?: string
}

/**
 * Displays sources being reviewed during agent activity
 * Expandable/collapsible list with document icons
 */
export function SourcesList({ sources, isActive, className }: SourcesListProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  if (sources.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden',
        isActive && 'border-brand-blue/30 shadow-sm',
        className
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
            <HugeiconsIcon
              icon={BookOpen01Icon}
              size={16}
              className="text-neutral-600 dark:text-neutral-400"
            />
          </div>

          {/* Title */}
          <div className="text-left">
            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {isActive ? 'Reviewing sources' : 'Sources reviewed'}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              {sources.length} source{sources.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Expand toggle */}
        <div className="flex items-center">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          )}
        </div>
      </button>

      {/* Expandable sources list */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 space-y-1.5 border-t border-neutral-100 dark:border-neutral-800">
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
      className="flex items-center gap-2.5 py-2 px-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
    >
      {/* Document icon */}
      <div className="flex-shrink-0 w-6 h-6 rounded bg-brand-blue/10 flex items-center justify-center">
        <HugeiconsIcon icon={File01Icon} size={14} className="text-brand-blue" />
      </div>

      {/* Source info */}
      <div className="flex-1 min-w-0">
        <span className="text-sm text-neutral-700 dark:text-neutral-300 truncate block">
          {source.title}
        </span>
        {source.category && (
          <span className="text-xs text-neutral-400 dark:text-neutral-500 capitalize">
            {source.category.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Body system badge */}
      {source.bodySystem && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 capitalize whitespace-nowrap">
          {source.bodySystem}
        </span>
      )}
    </motion.div>
  )
}
