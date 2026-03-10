'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
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
        <motion.div
          key={action.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 * index }}
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(action.href)}
            className="group bg-neutral-100 border border-neutral-200 text-neutral-700 hover:bg-neutral-200 hover:border-neutral-300"
          >
            <span>{action.label}</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </motion.div>
      ))}
    </motion.div>
  )
}
