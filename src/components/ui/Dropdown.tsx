'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface DropdownProps {
  trigger: ReactNode
  children: ReactNode
  align?: 'left' | 'right'
  position?: 'above' | 'below'
  className?: string
}

export function Dropdown({
  trigger,
  children,
  align = 'left',
  position = 'below',
  className,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isAbove = position === 'above'

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: isAbove ? 10 : -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: isAbove ? 10 : -10 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute z-50 min-w-[200px] bg-white dark:bg-neutral-800 rounded-xl py-2',
              'shadow-lg ring-1 ring-black/5 dark:ring-white/10',
              isAbove ? 'bottom-full mb-2' : 'mt-2',
              align === 'right' ? 'right-0' : 'left-0'
            )}
            onClick={() => setIsOpen(false)}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface DropdownItemProps {
  onClick?: () => void
  children: ReactNode
  className?: string
  disabled?: boolean
}

export function DropdownItem({
  onClick,
  children,
  className,
  disabled,
}: DropdownItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full text-left px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300',
        'hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
    >
      {children}
    </button>
  )
}

export function DropdownDivider() {
  return <div className="my-2 border-t border-neutral-100 dark:border-neutral-700" />
}
