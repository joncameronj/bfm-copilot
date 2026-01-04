'use client'

import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { formatRelativeTime } from '@/lib/utils'
import type { ProtocolWithFeedback } from '@/types/protocol'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
} from '@/types/protocol'

interface ProtocolCardProps {
  protocol: ProtocolWithFeedback
}

export function ProtocolCard({ protocol }: ProtocolCardProps) {
  const patientName = protocol.patient
    ? `${protocol.patient.firstName} ${protocol.patient.lastName}`
    : 'No patient assigned'

  const positiveCount = protocol.feedback.filter(f => f.outcome === 'positive').length
  const negativeCount = protocol.feedback.filter(f => f.outcome === 'negative').length
  const totalFeedback = protocol.feedback.length

  return (
    <Link href={`/protocols/${protocol.id}`}>
      <div className="bg-neutral-50 rounded-2xl p-6 hover:bg-neutral-100 transition-colors cursor-pointer">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {protocol.patient ? (
              <Avatar name={patientName} size="lg" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-neutral-200 flex items-center justify-center">
                <span className="text-neutral-400 text-xl">?</span>
              </div>
            )}
            <div>
              <h3 className="font-medium text-neutral-900 line-clamp-1">
                {protocol.title}
              </h3>
              <p className="text-sm text-neutral-500">
                {patientName}
              </p>
            </div>
          </div>
          <Badge
            variant={protocol.status === 'active' ? 'success' : protocol.status === 'completed' ? 'info' : 'neutral'}
            size="sm"
          >
            {STATUS_LABELS[protocol.status]}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <span className={`text-xs px-2 py-1 rounded-full ${CATEGORY_COLORS[protocol.category]}`}>
            {CATEGORY_LABELS[protocol.category]}
          </span>
          {protocol.durationDays && (
            <span className="text-xs px-2 py-1 rounded-full bg-neutral-100 text-neutral-600">
              {protocol.durationDays} days
            </span>
          )}
        </div>

        {protocol.notes && (
          <p className="text-sm text-neutral-600 line-clamp-2 mb-3">
            {protocol.notes}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex gap-3 text-xs text-neutral-500">
            {totalFeedback > 0 ? (
              <>
                <span className="text-green-600">{positiveCount} positive</span>
                <span className="text-red-600">{negativeCount} negative</span>
              </>
            ) : (
              <span>No feedback yet</span>
            )}
          </div>
          <span className="text-xs text-neutral-400">
            {formatRelativeTime(protocol.createdAt)}
          </span>
        </div>
      </div>
    </Link>
  )
}
