'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useTheme } from '@/providers/ThemeProvider'
import { cn } from '@/lib/utils'

interface ThinkingIndicatorProps {
  startTime?: number | null
  className?: string
}

export function ThinkingIndicator({ startTime, className }: ThinkingIndicatorProps) {
  const { resolvedTheme } = useTheme()
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Update elapsed time counter
  useEffect(() => {
    if (!startTime) {
      setElapsedSeconds(0)
      return
    }

    // Set initial elapsed time
    setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000))

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000))
    }, 100)

    return () => clearInterval(interval)
  }, [startTime])

  return (
    <div className={cn('flex justify-start', className)}>
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-neutral-900 border border-brand-blue/50 shadow-sm">
        <Image
          src={resolvedTheme === 'dark' ? '/icons/bfm-icon.svg' : '/icons/bfm-icon-black.svg'}
          alt=""
          width={20}
          height={24}
          className="animate-icon-pulse"
        />
        <span className="text-sm font-medium">
          <span className="text-shimmer">Thinking</span>
          <span className="text-neutral-700 dark:text-neutral-300 animate-pulse">...</span>
          <span className="ml-2 font-mono text-brand-blue tabular-nums">
            {elapsedSeconds}s
          </span>
        </span>
      </div>
    </div>
  )
}
