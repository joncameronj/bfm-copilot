'use client'

import { cn } from '@/lib/utils'
import { WORKFLOWS } from '@/types/chat'

interface WorkflowButtonsProps {
  onSelect: (workflowId: string) => void
  compact?: boolean
  disabled?: boolean
}

export function WorkflowButtons({
  onSelect,
  compact = false,
  disabled = false,
}: WorkflowButtonsProps) {
  if (compact) {
    return (
      <div className="flex flex-wrap gap-2 justify-center">
        {WORKFLOWS.map((workflow) => (
          <button
            key={workflow.id}
            onClick={() => onSelect(workflow.id)}
            disabled={disabled}
            className={cn(
              'text-neutral-500 px-4 py-2 rounded-lg text-sm font-medium',
              'transition-colors hover:text-neutral-900 hover:bg-neutral-100',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {workflow.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
      {WORKFLOWS.map((workflow) => (
        <button
          key={workflow.id}
          onClick={() => onSelect(workflow.id)}
          disabled={disabled}
          className={cn(
            'bg-neutral-50 rounded-2xl py-4 px-6 text-left',
            'transition-colors hover:bg-neutral-100',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <span className="text-neutral-900 font-medium">{workflow.label}</span>
        </button>
      ))}
    </div>
  )
}
