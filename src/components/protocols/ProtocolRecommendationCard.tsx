'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { PlayIcon, Cancel01Icon, Tick01Icon, Loading03Icon, ThumbsUpIcon } from '@hugeicons/core-free-icons'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/types/protocol'
import {
  RECOMMENDATION_STATUS_LABELS,
  RECOMMENDATION_STATUS_COLORS,
  type ProtocolRecommendation,
  type RecommendedFrequency,
} from '@/types/diagnostic-analysis'
import { cn } from '@/lib/utils'

interface ProtocolRecommendationCardProps {
  recommendation: ProtocolRecommendation
  onExecute: (id: string) => void
  onDecline: (id: string) => void
  onApprove?: (id: string) => void
  isLoading?: boolean
}

export function ProtocolRecommendationCard({
  recommendation,
  onExecute,
  onDecline,
  onApprove,
  isLoading = false,
}: ProtocolRecommendationCardProps) {
  const [expanded, setExpanded] = useState(false)

  const categoryLabel = CATEGORY_LABELS[recommendation.category] || recommendation.category
  const categoryColor = CATEGORY_COLORS[recommendation.category] || 'bg-neutral-100 text-neutral-700'
  const statusLabel = RECOMMENDATION_STATUS_LABELS[recommendation.status]
  const statusColor = RECOMMENDATION_STATUS_COLORS[recommendation.status]

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={cn('px-2 py-1 text-xs font-medium rounded-full', categoryColor)}>
              {categoryLabel}
            </span>
            <span className={cn('px-2 py-1 text-xs font-medium rounded-full', statusColor)}>
              {statusLabel}
            </span>
            {recommendation.priority <= 2 && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-50 text-red-700">
                High Priority
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-neutral-900">{recommendation.title}</h3>
          {recommendation.description && (
            <p className="text-sm text-neutral-600 mt-1">{recommendation.description}</p>
          )}
        </div>
      </div>

      {/* Frequencies */}
      {recommendation.recommendedFrequencies.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-neutral-600 hover:text-neutral-900 flex items-center gap-1"
          >
            {expanded ? 'Hide' : 'Show'} {recommendation.recommendedFrequencies.length} FSM Frequencies
            <svg
              className={cn('w-4 h-4 transition-transform', expanded && 'rotate-180')}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expanded && (
            <div className="mt-3 space-y-2">
              {recommendation.recommendedFrequencies.map((freq: RecommendedFrequency, idx: number) => (
                <div key={idx} className="bg-neutral-50 rounded-xl p-3">
                  <div className="mb-1">
                    <span className="font-medium text-neutral-900">{freq.name}</span>
                  </div>
                  {freq.rationale && (
                    <p className="text-sm text-neutral-600 mb-1">{freq.rationale}</p>
                  )}
                  {freq.source_reference && (
                    <p className="text-xs text-neutral-500">
                      <span className="font-medium">Source:</span> {freq.source_reference}
                    </p>
                  )}
                  {freq.diagnostic_trigger && (
                    <p className="text-xs text-neutral-500">
                      <span className="font-medium">Trigger:</span> {freq.diagnostic_trigger}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {recommendation.status === 'recommended' && (
        <div className="flex items-center gap-3 pt-4 border-t border-neutral-100">
          {onApprove && (
            <Button
              variant="secondary"
              onClick={() => onApprove(recommendation.id)}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <HugeiconsIcon icon={Loading03Icon} size={18} className="animate-spin" />
              ) : (
                <HugeiconsIcon icon={ThumbsUpIcon} size={18} />
              )}
              Approve
            </Button>
          )}
          <Button
            onClick={() => onExecute(recommendation.id)}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <HugeiconsIcon icon={Loading03Icon} size={18} className="animate-spin" />
            ) : (
              <HugeiconsIcon icon={PlayIcon} size={18} />
            )}
            Execute Protocol
          </Button>
          <Button
            variant="secondary"
            onClick={() => onDecline(recommendation.id)}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={18} />
            Decline
          </Button>
        </div>
      )}

      {/* Approved status */}
      {recommendation.status === 'approved' && (
        <div className="flex items-center gap-3 pt-4 border-t border-neutral-100">
          <div className="flex items-center gap-2 text-green-600">
            <HugeiconsIcon icon={ThumbsUpIcon} size={18} />
            <span className="text-sm font-medium">Approved</span>
          </div>
          <Button
            onClick={() => onExecute(recommendation.id)}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <HugeiconsIcon icon={Loading03Icon} size={18} className="animate-spin" />
            ) : (
              <HugeiconsIcon icon={PlayIcon} size={18} />
            )}
            Execute Protocol
          </Button>
        </div>
      )}

      {/* Executed status */}
      {recommendation.status === 'executed' && (
        <div className="flex items-center gap-2 pt-4 border-t border-neutral-100 text-green-600">
          <HugeiconsIcon icon={Tick01Icon} size={18} />
          <span className="text-sm font-medium">Protocol Executed</span>
        </div>
      )}

      {/* Declined status */}
      {recommendation.status === 'declined' && (
        <div className="flex items-center gap-2 pt-4 border-t border-neutral-100 text-neutral-500">
          <HugeiconsIcon icon={Cancel01Icon} size={18} />
          <span className="text-sm">Declined</span>
        </div>
      )}
    </div>
  )
}
