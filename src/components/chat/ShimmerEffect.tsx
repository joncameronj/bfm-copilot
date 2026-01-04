'use client'

import { cn } from '@/lib/utils'

interface ShimmerEffectProps {
  /** Whether the shimmer is active */
  isActive?: boolean
  /** Content to wrap with shimmer effect */
  children: React.ReactNode
  /** Additional classes for the wrapper */
  className?: string
  /** Shimmer variant */
  variant?: 'bubble' | 'line' | 'block'
}

/**
 * Shimmer effect component for loading states
 * Uses brand gradient for premium feel
 */
export function ShimmerEffect({
  isActive = true,
  children,
  className,
  variant = 'bubble',
}: ShimmerEffectProps) {
  if (!isActive) {
    return <>{children}</>
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {children}
      <div
        className={cn(
          'absolute inset-0 -translate-x-full animate-shimmer',
          'bg-gradient-to-r from-transparent via-white/20 to-transparent',
          variant === 'bubble' && 'rounded-2xl',
          variant === 'line' && 'rounded-md',
          variant === 'block' && 'rounded-lg'
        )}
      />
    </div>
  )
}

/**
 * Standalone shimmer line for skeleton loading
 */
export function ShimmerLine({
  width = '100%',
  height = '1rem',
  className,
}: {
  width?: string | number
  height?: string | number
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-neutral-200',
        className
      )}
      style={{ width, height }}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  )
}

/**
 * Shimmer skeleton for text content
 */
export function ShimmerText({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <ShimmerLine
          key={i}
          width={i === lines - 1 ? '60%' : '100%'}
          height="0.875rem"
        />
      ))}
    </div>
  )
}

/**
 * Thinking shimmer with brand gradient border
 */
export function ThinkingShimmer({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative rounded-2xl overflow-hidden',
        'before:absolute before:inset-0 before:-z-10',
        'before:bg-gradient-to-r before:from-brand-blue before:to-brand-cyan',
        'before:animate-shimmer-border before:bg-[length:200%_100%]',
        'p-[2px]',
        className
      )}
    >
      <div className="bg-neutral-100 rounded-2xl h-full">{children}</div>
    </div>
  )
}
