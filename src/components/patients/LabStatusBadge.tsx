'use client'

import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'

interface LabStatusBadgeProps {
  labCount: number
  lastLabDate?: string | null
  className?: string
}

/**
 * Displays lab status badge on patient profile
 * - "No labs" (gray) - no lab_results entries
 * - "Labs updated" (green) - has lab_results with date
 */
export function LabStatusBadge({ labCount, lastLabDate, className = '' }: LabStatusBadgeProps) {
  if (labCount === 0) {
    return (
      <Badge variant="neutral" className={className}>
        No labs
      </Badge>
    )
  }

  return (
    <Badge variant="success" className={className}>
      Labs updated {lastLabDate ? formatDate(lastLabDate) : ''}
    </Badge>
  )
}
