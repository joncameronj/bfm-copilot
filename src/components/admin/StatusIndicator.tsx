'use client'

import { cn } from '@/lib/utils'
import { HealthStatus } from '@/types/health'

interface StatusIndicatorProps {
  status: HealthStatus
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

const statusConfig = {
  healthy: {
    color: 'bg-green-500',
    ring: 'ring-green-500/30',
    label: 'Healthy',
    textColor: 'text-green-700 dark:text-green-400',
  },
  degraded: {
    color: 'bg-yellow-500',
    ring: 'ring-yellow-500/30',
    label: 'Degraded',
    textColor: 'text-yellow-700 dark:text-yellow-400',
  },
  unhealthy: {
    color: 'bg-red-500',
    ring: 'ring-red-500/30',
    label: 'Unhealthy',
    textColor: 'text-red-700 dark:text-red-400',
  },
  unknown: {
    color: 'bg-neutral-400',
    ring: 'ring-neutral-400/30',
    label: 'Unknown',
    textColor: 'text-neutral-600 dark:text-neutral-400',
  },
}

const sizes = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
}

export function StatusIndicator({
  status,
  size = 'md',
  showLabel,
  className
}: StatusIndicatorProps) {
  const config = statusConfig[status]

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className={cn(
          'rounded-full ring-4',
          config.color,
          config.ring,
          sizes[size],
          status === 'unhealthy' && 'animate-pulse'
        )}
      />
      {showLabel && (
        <span className={cn('text-sm font-medium', config.textColor)}>
          {config.label}
        </span>
      )}
    </div>
  )
}
