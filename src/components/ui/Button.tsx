'use client'

import { forwardRef, ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 dark:focus:ring-neutral-50/20 disabled:opacity-50 disabled:cursor-not-allowed'

    const variants = {
      primary:
        'bg-neutral-900 dark:bg-neutral-50 text-white dark:text-neutral-900 rounded-2xl hover:bg-neutral-800 dark:hover:bg-neutral-200 active:scale-[0.98]',
      secondary:
        'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 rounded-2xl hover:bg-neutral-200 dark:hover:bg-neutral-700 active:scale-[0.98]',
      ghost:
        'bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-2xl hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-900 dark:hover:text-neutral-50 active:scale-[0.98]',
      danger:
        'bg-red-500 text-white rounded-2xl hover:bg-red-600 active:scale-[0.98]',
      outline:
        'bg-transparent border-2 border-neutral-900 dark:border-neutral-50 text-neutral-900 dark:text-neutral-50 rounded-2xl hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-[0.98]',
    }

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    }

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : null}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button }
