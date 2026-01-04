'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import { Loading03Icon, Tick02Icon, Cancel01Icon, AiCloud02Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

export type AnalysisStatus = 'idle' | 'uploading' | 'analyzing' | 'generating' | 'complete' | 'error'

interface AnalysisStatusIndicatorProps {
  status: AnalysisStatus
  className?: string
}

const statusConfig: Record<AnalysisStatus, {
  text: string
  icon: typeof Loading03Icon
  color: string
  bgColor: string
  animate?: boolean
}> = {
  idle: {
    text: '',
    icon: Loading03Icon,
    color: 'text-neutral-400',
    bgColor: 'bg-neutral-50',
  },
  uploading: {
    text: 'Uploading files...',
    icon: Loading03Icon,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    animate: true,
  },
  analyzing: {
    text: 'COPILOT is analyzing...',
    icon: AiCloud02Icon,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    animate: true,
  },
  generating: {
    text: 'Generating protocol recommendations...',
    icon: AiCloud02Icon,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    animate: true,
  },
  complete: {
    text: 'Analysis complete!',
    icon: Tick02Icon,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  error: {
    text: 'Analysis failed',
    icon: Cancel01Icon,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
}

export function AnalysisStatusIndicator({
  status,
  className,
}: AnalysisStatusIndicatorProps) {
  // Don't render anything for idle status
  if (status === 'idle') {
    return null
  }

  const config = statusConfig[status]

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl',
        config.bgColor,
        className
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center',
          config.animate && 'animate-pulse'
        )}
      >
        <HugeiconsIcon
          icon={config.icon}
          size={24}
          className={cn(
            config.color,
            config.animate && status === 'uploading' && 'animate-spin'
          )}
        />
      </div>
      <span className={cn('font-medium', config.color)}>
        {config.text}
      </span>
    </div>
  )
}
