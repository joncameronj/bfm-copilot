'use client'

import Link from 'next/link'
import { OminousAlert } from '@/components/labs/OminousAlert'
import { formatDate, cn } from '@/lib/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft02Icon, Tick02Icon, Alert01Icon } from '@hugeicons/core-free-icons'

interface MemberLabValue {
  id: string
  marker_name: string
  value: number
  unit: string
  test_date: string
  evaluation: string | null
  delta_from_target: number | null
  is_ominous: boolean
  weakness_text: string | null
  category: string | null
}

interface MemberLabDetailProps {
  labValues: MemberLabValue[]
  testDate: string
}

export function MemberLabDetail({ labValues, testDate }: MemberLabDetailProps) {
  // Group by category
  const categories = [...new Set(labValues.map(v => v.category).filter(Boolean))] as string[]
  const uncategorized = labValues.filter(v => !v.category)

  const valuesByCategory = categories.map(cat => ({
    name: cat,
    values: labValues.filter(v => v.category === cat),
  }))

  if (uncategorized.length > 0) {
    valuesByCategory.push({ name: 'Other', values: uncategorized })
  }

  // Stats
  const totalMarkers = labValues.length
  const normalCount = labValues.filter(v => v.evaluation === 'normal').length
  const flaggedCount = labValues.filter(v => v.evaluation && v.evaluation !== 'normal').length
  const ominousCount = labValues.filter(v => v.is_ominous).length
  const ominousMarkers = labValues.filter(v => v.is_ominous).map(v => v.marker_name)

  const getEvaluationStyle = (evaluation: string | null) => {
    switch (evaluation) {
      case 'low':
        return { bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-800' }
      case 'normal':
        return { bg: 'bg-green-50', badge: 'bg-green-100 text-green-800' }
      case 'moderate':
        return { bg: 'bg-yellow-50', badge: 'bg-yellow-100 text-yellow-800' }
      case 'high':
        return { bg: 'bg-red-50', badge: 'bg-red-100 text-red-800' }
      default:
        return { bg: 'bg-neutral-50', badge: 'bg-neutral-100 text-neutral-600' }
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/my-labs"
          className="text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} size={24} />
        </Link>
        <div>
          <h1 className="text-4xl font-bold tracking-[-0.05em]">My Lab Results</h1>
          <p className="text-neutral-500">{formatDate(testDate)}</p>
        </div>
      </div>

      {/* Ominous Alert */}
      {ominousCount >= 3 && (
        <OminousAlert count={ominousCount} markers={ominousMarkers} />
      )}

      {/* Summary Stats */}
      <div className="card-flat mb-6">
        <h2 className="text-lg font-medium mb-4">Summary</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-neutral-100 rounded-xl">
            <p className="text-2xl font-semibold">{totalMarkers}</p>
            <p className="text-sm text-neutral-500">Total</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-xl">
            <p className="text-2xl font-semibold text-green-900">{normalCount}</p>
            <p className="text-sm text-green-700">Normal</p>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-xl">
            <p className="text-2xl font-semibold text-yellow-900">{flaggedCount}</p>
            <p className="text-sm text-yellow-700">Flagged</p>
          </div>
        </div>
        {ominousCount > 0 && (
          <div className="mt-4 p-3 bg-red-50 rounded-xl text-center">
            <p className="text-lg font-semibold text-red-900">
              {ominousCount} Ominous Markers
            </p>
          </div>
        )}
      </div>

      {/* Results by Category */}
      <div className="space-y-6">
        {valuesByCategory.map(({ name, values }) => (
          <div key={name} className="card-flat">
            <h2 className="text-lg font-medium mb-4 capitalize">{name}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {values.map((value) => {
                const style = getEvaluationStyle(value.evaluation)
                return (
                  <div key={value.id} className={cn('rounded-xl p-4', style.bg)}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-neutral-900">
                          {value.marker_name}
                          {value.is_ominous && (
                            <span className="ml-2 text-xs text-red-600">(Ominous)</span>
                          )}
                        </p>
                      </div>
                      {value.evaluation && (
                        <span className={cn('text-xs font-medium px-2 py-1 rounded-full capitalize', style.badge)}>
                          {value.evaluation}
                        </span>
                      )}
                    </div>
                    <p className="text-lg font-semibold text-neutral-900">
                      {value.value} <span className="text-sm font-normal text-neutral-500">{value.unit}</span>
                    </p>
                    {value.delta_from_target !== null && (
                      <p className="text-sm text-neutral-500 mt-1">
                        Delta: {value.delta_from_target > 0 ? '+' : ''}{value.delta_from_target}
                      </p>
                    )}
                    {value.weakness_text && (
                      <details className="mt-2">
                        <summary className="text-sm text-neutral-600 cursor-pointer">
                          View details
                        </summary>
                        <p className="text-sm text-neutral-700 mt-2 p-2 bg-white/50 rounded-lg">
                          {value.weakness_text}
                        </p>
                      </details>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
