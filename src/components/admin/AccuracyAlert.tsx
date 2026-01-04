'use client'

import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import { Alert01Icon } from '@hugeicons/core-free-icons'

interface AccuracyAlertProps {
  accuracy: number
  threshold: number
  period: string
}

export function AccuracyAlert({ accuracy, threshold, period }: AccuracyAlertProps) {
  if (accuracy >= threshold) {
    return null
  }

  const periodLabel = period === '7d' ? '7 days' : period === '30d' ? '30 days' : period

  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
          <HugeiconsIcon icon={Alert01Icon} size={20} className="text-red-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-red-900">
            Accuracy Below Threshold
          </h3>
          <p className="text-sm text-red-700 mt-1">
            Current accuracy is <strong>{accuracy}%</strong> (threshold: {threshold}%)
            over the last {periodLabel}.
          </p>
          <Link
            href="/admin/analytics"
            className="text-sm text-red-800 underline mt-2 inline-block hover:text-red-900"
          >
            View Analytics →
          </Link>
        </div>
      </div>
    </div>
  )
}
