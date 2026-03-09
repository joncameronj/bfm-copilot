'use client'

import { cn } from '@/lib/utils'

interface UnreadBadgeProps {
  count: number
  className?: string
}

export function UnreadBadge({ count, className }: UnreadBadgeProps) {
  if (count <= 0) return null

  return (
    <span
      className={cn(
        'flex items-center justify-center',
        'min-w-[18px] h-[18px] px-1',
        'text-[10px] font-bold text-white',
        'bg-red-500 rounded-full',
        'animate-in fade-in zoom-in-50 duration-200',
        className
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
