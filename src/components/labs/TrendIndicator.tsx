'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowUp01Icon, ArrowDown01Icon, MinusSignIcon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

interface TrendIndicatorProps {
  current: number
  previous: number
  /** For lab values, "up" is usually bad (red), "down" is good (green). Set to true if opposite. */
  invertColors?: boolean
}

export function TrendIndicator({ current, previous, invertColors = false }: TrendIndicatorProps) {
  const change = ((current - previous) / previous) * 100
  const isUp = change > 5
  const isDown = change < -5

  // Default: up is red (bad), down is green (good)
  // Inverted: up is green (good), down is red (bad)
  const upColor = invertColors ? 'text-green-600' : 'text-red-600'
  const downColor = invertColors ? 'text-red-600' : 'text-green-600'

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-neutral-600">Trend:</span>
      <span
        className={cn(
          'flex items-center gap-1 font-medium',
          isUp && upColor,
          isDown && downColor,
          !isUp && !isDown && 'text-neutral-500'
        )}
      >
        {isUp ? (
          <>
            <HugeiconsIcon icon={ArrowUp01Icon} size={16} /> Up {Math.abs(change).toFixed(1)}%
          </>
        ) : isDown ? (
          <>
            <HugeiconsIcon icon={ArrowDown01Icon} size={16} /> Down {Math.abs(change).toFixed(1)}%
          </>
        ) : (
          <>
            <HugeiconsIcon icon={MinusSignIcon} size={16} /> Stable
          </>
        )}
      </span>
    </div>
  )
}
