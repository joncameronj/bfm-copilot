'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import {
  Search01Icon,
  Alert01Icon,
  TestTubeIcon,
  File01Icon,
  StarIcon,
  StethoscopeIcon,
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/Button'
import type { QuickAction } from '@/types/patient-context'
import type { IconSvgElement } from '@hugeicons/react'

// Map icon names to actual icons
const iconMap: Record<string, IconSvgElement> = {
  Search01Icon,
  Alert01Icon,
  Alert02Icon: Alert01Icon,
  TestTube01Icon: TestTubeIcon,
  TestTubeIcon,
  MessageQuestion01Icon: Search01Icon,
  Clipboard01Icon: File01Icon,
  File01Icon,
  ChartLineData01Icon: StarIcon,
  StarIcon,
  HeartbeatIcon: StethoscopeIcon,
  StethoscopeIcon,
}

interface QuickActionsBarProps {
  actions: QuickAction[]
  onActionClick: (prompt: string) => void
  disabled?: boolean
}

export function QuickActionsBar({ actions, onActionClick, disabled = false }: QuickActionsBarProps) {
  if (actions.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mt-4">
      {actions.map((action) => {
        const IconComponent = iconMap[action.icon] || Search01Icon

        return (
          <Button
            key={action.id}
            variant="secondary"
            size="sm"
            onClick={() => onActionClick(action.prompt)}
            disabled={disabled}
            className="bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 shadow-sm hover:shadow"
          >
            <HugeiconsIcon icon={IconComponent} size={18} className="text-neutral-500" />
            <span>{action.label}</span>
          </Button>
        )
      })}
    </div>
  )
}
