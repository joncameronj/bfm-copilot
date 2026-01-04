'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  type ProtocolWithFeedback,
} from '@/types/protocol'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ProtocolsTableProps {
  protocols: ProtocolWithFeedback[]
  onProtocolClick?: (id: string) => void
}

export function ProtocolsTable({ protocols, onProtocolClick }: ProtocolsTableProps) {
  if (protocols.length === 0) {
    return (
      <div className="bg-neutral-50 rounded-2xl p-12 text-center">
        <p className="text-neutral-500">No protocols found.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50">
            <th className="text-left px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Protocol
            </th>
            <th className="text-left px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Patient
            </th>
            <th className="text-left px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Category
            </th>
            <th className="text-left px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Status
            </th>
            <th className="text-left px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Feedback
            </th>
            <th className="text-left px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Created
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {protocols.map((protocol) => {
            const categoryLabel = CATEGORY_LABELS[protocol.category] || protocol.category
            const categoryColor = CATEGORY_COLORS[protocol.category] || 'bg-neutral-100 text-neutral-700'
            const statusLabel = STATUS_LABELS[protocol.status] || protocol.status
            const statusColor = STATUS_COLORS[protocol.status] || 'bg-neutral-100 text-neutral-700'

            const positiveFeedback = protocol.feedback?.filter(f => f.outcome === 'positive').length || 0
            const negativeFeedback = protocol.feedback?.filter(f => f.outcome === 'negative').length || 0

            return (
              <tr
                key={protocol.id}
                className="hover:bg-neutral-50 transition-colors cursor-pointer"
                onClick={() => onProtocolClick?.(protocol.id)}
              >
                <td className="px-6 py-4">
                  <Link
                    href={`/protocols/${protocol.id}`}
                    className="font-medium text-neutral-900 hover:text-brand-blue transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {protocol.title}
                  </Link>
                </td>
                <td className="px-6 py-4">
                  {protocol.patient ? (
                    <Link
                      href={`/patients/${protocol.patient.id}`}
                      className="text-neutral-600 hover:text-brand-blue transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {protocol.patient.firstName} {protocol.patient.lastName}
                    </Link>
                  ) : (
                    <span className="text-neutral-400">No patient</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={cn('px-2 py-1 text-xs font-medium rounded-full', categoryColor)}>
                    {categoryLabel}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={cn('px-2 py-1 text-xs font-medium rounded-full', statusColor)}>
                    {statusLabel}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {positiveFeedback > 0 && (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        +{positiveFeedback}
                      </span>
                    )}
                    {negativeFeedback > 0 && (
                      <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
                        -{negativeFeedback}
                      </span>
                    )}
                    {positiveFeedback === 0 && negativeFeedback === 0 && (
                      <span className="text-neutral-400">-</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-neutral-500">
                  {formatDate(protocol.createdAt.toISOString())}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
