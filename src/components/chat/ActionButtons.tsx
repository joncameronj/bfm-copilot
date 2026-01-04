'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ActionButton } from '@/types/chat'

interface ActionButtonsProps {
  actions: ActionButton[]
  className?: string
}

/**
 * Displays smart action buttons at the end of assistant messages
 * These are contextually suggested based on conversation intent
 */
export function ActionButtons({ actions, className }: ActionButtonsProps) {
  const router = useRouter()

  if (actions.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={cn('flex flex-wrap gap-2', className)}
    >
      {actions.map((action, index) => (
        <motion.button
          key={action.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 * index }}
          onClick={() => router.push(action.href)}
          className={cn(
            'group flex items-center gap-2 p-4 rounded-2xl',
            'bg-neutral-100 border border-neutral-200',
            'text-sm font-medium text-neutral-700',
            'transition-all duration-200',
            'hover:bg-neutral-200 hover:border-neutral-300',
            'focus:outline-none focus:ring-2 focus:ring-neutral-900/20',
            'active:scale-[0.98]'
          )}
        >
          <span>{action.label}</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </motion.button>
      ))}
    </motion.div>
  )
}
