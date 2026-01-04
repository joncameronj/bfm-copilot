'use client'

import { useState } from 'react'
import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import { Calendar03Icon, Alert01Icon } from '@hugeicons/core-free-icons'
import { LabHistoryChart } from '@/components/labs/LabHistoryChart'
import { TrendIndicator } from '@/components/labs/TrendIndicator'

interface LabResult {
  id: string
  test_date: string
  ominous_count: number
  ominous_markers_triggered: string[] | null
  notes: string | null
  created_at: string
  lab_values: Array<{
    id: string
    marker_id: string
    value: number
    evaluation: string | null
    delta_from_target: number | null
    is_ominous: boolean
  }>
}

interface Marker {
  id: string
  name: string
  display_name: string
  unit: string | null
  category: string
}

interface MyLabsClientProps {
  results: LabResult[]
  markers: Marker[]
}

export function MyLabsClient({ results, markers }: MyLabsClientProps) {
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null)

  const markerMap = new Map(markers.map((m) => [m.id, m]))

  // Get unique markers from results
  const availableMarkers = new Set<string>()
  results.forEach((r) => {
    r.lab_values.forEach((v) => availableMarkers.add(v.marker_id))
  })

  // Build chart data for selected marker
  const chartData = selectedMarker
    ? results
        .map((r) => {
          const value = r.lab_values.find((v) => v.marker_id === selectedMarker)
          return value
            ? { date: r.test_date, value: value.value, evaluation: value.evaluation }
            : null
        })
        .filter(Boolean)
        .reverse()
    : []

  const selectedMarkerInfo = selectedMarker ? markerMap.get(selectedMarker) : null

  if (results.length === 0) {
    return (
      <div className="bg-neutral-50 rounded-2xl p-8 text-center">
        <p className="text-neutral-600">No lab results yet.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Results list */}
      <div className="lg:col-span-2 space-y-4">
        <h2 className="font-medium text-neutral-900">Recent Results</h2>
        {results.map((result) => (
          <Link
            key={result.id}
            href={`/labs/${result.id}`}
            className="block bg-white border border-neutral-200 rounded-2xl p-4 hover:border-neutral-300 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={Calendar03Icon} size={16} className="text-neutral-400" />
                <span className="font-medium">
                  {new Date(result.test_date).toLocaleDateString()}
                </span>
              </div>
              {result.ominous_count > 0 && (
                <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
                  <HugeiconsIcon icon={Alert01Icon} size={12} />
                  {result.ominous_count} critical
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-500 mt-2">
              {result.lab_values.length} markers tested
            </p>
          </Link>
        ))}
      </div>

      {/* Chart section */}
      <div className="space-y-4">
        <h2 className="font-medium text-neutral-900">Track a Marker</h2>

        {/* Marker selector */}
        <select
          value={selectedMarker || ''}
          onChange={(e) => setSelectedMarker(e.target.value || null)}
          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
        >
          <option value="">Select a marker...</option>
          {Array.from(availableMarkers).map((markerId) => {
            const marker = markerMap.get(markerId)
            return (
              <option key={markerId} value={markerId}>
                {marker?.display_name || marker?.name || markerId}
              </option>
            )
          })}
        </select>

        {/* Chart */}
        {selectedMarker && chartData.length > 0 && (
          <div className="bg-white border border-neutral-200 rounded-2xl p-4">
            <h3 className="font-medium text-sm mb-4">
              {selectedMarkerInfo?.display_name || selectedMarkerInfo?.name}
              {selectedMarkerInfo?.unit && (
                <span className="text-neutral-500 font-normal ml-1">
                  ({selectedMarkerInfo.unit})
                </span>
              )}
            </h3>
            <LabHistoryChart
              data={chartData as Array<{ date: string; value: number; evaluation: string | null }>}
              unit={selectedMarkerInfo?.unit || ''}
            />

            {/* Trend indicator */}
            {chartData.length >= 2 && (
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <TrendIndicator
                  current={chartData[chartData.length - 1]?.value as number}
                  previous={chartData[chartData.length - 2]?.value as number}
                />
              </div>
            )}
          </div>
        )}

        {selectedMarker && chartData.length < 2 && (
          <p className="text-sm text-neutral-500 text-center py-4">
            Need at least 2 data points to show chart
          </p>
        )}
      </div>
    </div>
  )
}
