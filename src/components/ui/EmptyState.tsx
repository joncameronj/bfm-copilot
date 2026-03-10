'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-12 px-4', className)}>
      {icon && <div className="text-neutral-300 dark:text-neutral-600 mb-4">{icon}</div>}
      <p className="text-base font-medium text-neutral-600 dark:text-neutral-400">{title}</p>
      {description && (
        <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1.5 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
