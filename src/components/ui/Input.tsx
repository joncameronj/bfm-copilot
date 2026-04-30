'use client'

import { forwardRef, InputHTMLAttributes, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ViewIcon, ViewOffIcon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, type = 'text', id, disabled, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const [showPassword, setShowPassword] = useState(false)
    const isPassword = type === 'password'
    const resolvedType = isPassword && showPassword ? 'text' : type

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
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            disabled={disabled}
            className={cn(
              'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 rounded-xl px-4 py-3 w-full',
              'placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2',
              'focus:ring-brand-blue/20 dark:focus:ring-brand-blue/30 transition-all duration-200',
              isPassword && 'pr-12',
              error && 'ring-2 ring-red-500/50',
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              disabled={disabled}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200 dark:focus:ring-brand-blue/30"
            >
              <HugeiconsIcon
                icon={showPassword ? ViewOffIcon : ViewIcon}
                size={18}
                color="currentColor"
              />
            </button>
          )}
        </div>
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
