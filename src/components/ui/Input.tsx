'use client'

import { forwardRef, InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, type = 'text', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={cn(
            'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 rounded-xl px-4 py-3 w-full',
            'placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2',
            'focus:ring-brand-blue/20 dark:focus:ring-brand-blue/30 transition-all duration-200',
            error && 'ring-2 ring-red-500/50',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1.5 text-sm text-red-500 dark:text-red-400">{error}</p>}
        {helperText && !error && (
          <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">{helperText}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }
