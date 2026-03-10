'use client'

import { cn } from '@/lib/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import { Alert01Icon, Tick02Icon, InformationCircleIcon } from '@hugeicons/core-free-icons'
import type { ReactNode } from 'react'
import type { IconSvgElement } from '@hugeicons/react'

type AlertVariant = 'error' | 'success' | 'warning' | 'info'

interface AlertMessageProps {
  variant: AlertVariant
  children: ReactNode
  action?: ReactNode
  className?: string
}

const variantStyles: Record<AlertVariant, { bg: string; icon: IconSvgElement }> = {
  error: {
    bg: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
    icon: Alert01Icon,
  },
  success: {
    bg: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    icon: Tick02Icon,
  },
  warning: {
    bg: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
    icon: Alert01Icon,
  },
  info: {
    bg: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    icon: InformationCircleIcon,
  },
}

export function AlertMessage({ variant, children, action, className }: AlertMessageProps) {
  const { bg, icon } = variantStyles[variant]

  return (
    <div className={cn('flex items-start gap-3 rounded-xl px-4 py-3 text-sm', bg, className)}>
      <HugeiconsIcon icon={icon} size={18} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1">{children}</div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
