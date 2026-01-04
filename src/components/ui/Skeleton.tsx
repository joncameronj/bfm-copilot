'use client'

import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
}

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
}: SkeletonProps) {
  const variants = {
    text: 'rounded-lg h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
  }

  return (
    <div
      className={cn(
        'animate-pulse bg-neutral-200',
        variants[variant],
        className
      )}
      style={{
        width: width,
        height: height,
      }}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-neutral-50 rounded-2xl p-6 space-y-4">
      <div className="flex items-center space-x-4">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton width="60%" height={16} />
          <Skeleton width="40%" height={12} />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton width="100%" height={12} />
        <Skeleton width="80%" height={12} />
        <Skeleton width="60%" height={12} />
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 py-3">
          <Skeleton width={32} height={32} variant="circular" />
          <Skeleton width="30%" height={16} />
          <Skeleton width="20%" height={16} />
          <Skeleton width="15%" height={16} />
          <Skeleton width="10%" height={16} />
        </div>
      ))}
    </div>
  )
}
