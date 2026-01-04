'use client'

import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: number | string
  subtitle?: string
  variant?: 'default' | 'danger' | 'success' | 'warning'
  trend?: {
    value: number
    isPositive: boolean
  }
}

export function StatsCard({
  title,
  value,
  subtitle,
  variant = 'default',
  trend,
}: StatsCardProps) {
  const bgColor = {
    default: 'bg-neutral-50',
    danger: 'bg-red-50',
    success: 'bg-green-50',
    warning: 'bg-yellow-50',
  }[variant]

  const textColor = {
    default: 'text-neutral-900',
    danger: 'text-red-900',
    success: 'text-green-900',
    warning: 'text-yellow-900',
  }[variant]

  return (
    <div className={cn('rounded-2xl p-6', bgColor)}>
      <p className="text-sm text-neutral-500 mb-1">{title}</p>
      <div className="flex items-end gap-2">
        <p className={cn('text-3xl font-semibold', textColor)}>{value}</p>
        {trend && (
          <span
            className={cn(
              'text-sm font-medium mb-1',
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            )}
          >
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-sm text-neutral-400 mt-1">{subtitle}</p>
      )}
    </div>
  )
}
