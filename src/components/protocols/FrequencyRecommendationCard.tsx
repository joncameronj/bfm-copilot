'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import {
  PlayIcon,
  Cancel01Icon,
  Tick01Icon,
  Loading03Icon
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/Button'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/types/protocol'
import type { FlattenedFrequencyCard } from '@/types/diagnostic-analysis'
import { cn } from '@/lib/utils'

interface FrequencyRecommendationCardProps {
  frequency: FlattenedFrequencyCard
  onToggleExecution: (frequencyId: string) => void
  onDecline: (originalProtocolId: string) => void
  isLoading?: boolean
}

export function FrequencyRecommendationCard({
  frequency,
  onToggleExecution,
  onDecline,
  isLoading = false,
}: FrequencyRecommendationCardProps) {
  const categoryLabel = CATEGORY_LABELS[frequency.category] || frequency.category
  const categoryColor = CATEGORY_COLORS[frequency.category] || 'bg-neutral-100 text-neutral-700'

  const isStaged = frequency.pendingExecution
  const isAlreadyExecuted = frequency.status === 'executed'
  const isDeclined = frequency.status === 'declined'

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-4">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', categoryColor)}>
            {categoryLabel}
          </span>
        </div>

        {/* Frequency Name (Main Title) */}
        <h3 className="text-sm font-semibold text-neutral-900 mb-1.5">
          {frequency.frequencyName}
        </h3>

        {/* Rationale */}
        {frequency.frequencyRationale && (
          <p className="text-xs text-neutral-700 leading-relaxed mb-1.5">{frequency.frequencyRationale}</p>
        )}

        {/* Metadata */}
        <div className="space-y-0.5">
          {frequency.diagnosticTrigger && (
            <p className="text-xs text-neutral-500">
              <span className="font-medium">Trigger:</span> {frequency.diagnosticTrigger}
            </p>
          )}
          {frequency.sourceReference && (
            <p className="text-xs text-neutral-500">
              <span className="font-medium">Source:</span> {frequency.sourceReference}
            </p>
          )}
        </div>
      </div>

      {/* Actions - Show for recommended status only */}
      {frequency.status === 'recommended' && !isDeclined && (
        <div className="flex items-center gap-2 pt-3 border-t border-neutral-100">
          {!isStaged ? (
            <>
              <Button
                size="sm"
                onClick={() => onToggleExecution(frequency.frequencyId)}
                disabled={isLoading}
                className="flex items-center gap-1.5 text-xs"
              >
                {isLoading ? (
                  <HugeiconsIcon icon={Loading03Icon} size={14} className="animate-spin" />
                ) : (
                  <HugeiconsIcon icon={PlayIcon} size={14} />
                )}
                Execute
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onDecline(frequency.originalProtocolId)}
                disabled={isLoading}
                className="flex items-center gap-1.5 text-xs bg-red-50 text-red-600 hover:bg-red-100"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={14} />
                Decline
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                onClick={() => onToggleExecution(frequency.frequencyId)}
                className="flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
              >
                <HugeiconsIcon icon={Tick01Icon} size={14} />
                Executed
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onDecline(frequency.originalProtocolId)}
                disabled={isLoading}
                className="flex items-center gap-1.5 text-xs bg-red-50 text-red-600 hover:bg-red-100"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={14} />
                Decline
              </Button>
            </>
          )}
        </div>
      )}

      {/* Already Executed Status */}
      {isAlreadyExecuted && (
        <div className="flex items-center gap-1.5 pt-3 border-t border-neutral-100 text-emerald-600">
          <HugeiconsIcon icon={Tick01Icon} size={14} />
          <span className="text-xs font-medium">Protocol Executed</span>
        </div>
      )}

      {/* Declined Status */}
      {isDeclined && (
        <div className="flex items-center gap-1.5 pt-3 border-t border-neutral-100 text-red-600">
          <HugeiconsIcon icon={Cancel01Icon} size={14} />
          <span className="text-xs">Declined</span>
        </div>
      )}
    </div>
  )
}
