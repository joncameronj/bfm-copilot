'use client';

import type { LabCalculationResult } from '@/types/labs';
import { LAB_CATEGORIES } from '@/lib/labs/categories';
import { CategoryResultsSummary } from './CategorySection';

interface ResultsSummaryProps {
  results: LabCalculationResult;
}

export function ResultsSummary({ results }: ResultsSummaryProps) {
  const totalMarkers = results.results.length;
  const flaggedCount = results.results.filter((r) => r.isFlagged).length;
  const normalCount = results.results.filter((r) => r.evaluation === 'normal').length;
  const lowCount = results.results.filter((r) => r.evaluation === 'low').length;
  const moderateCount = results.results.filter((r) => r.evaluation === 'moderate').length;
  const highCount = results.results.filter((r) => r.evaluation === 'high').length;

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Markers" value={totalMarkers} variant="neutral" />
        <StatCard label="Normal" value={normalCount} variant="success" />
        <StatCard label="Low" value={lowCount} variant="info" />
        <StatCard label="Moderate" value={moderateCount} variant="warning" />
        <StatCard label="High" value={highCount} variant="danger" />
      </div>

      {/* Ominous Summary */}
      {results.ominousCount > 0 && (
        <div className="bg-red-50 rounded-xl p-4">
          <h4 className="font-medium text-red-900 mb-2">
            Ominous Markers ({results.ominousCount}/7)
          </h4>
          <div className="flex flex-wrap gap-2">
            {results.ominousMarkersTriggered.map((marker) => (
              <span
                key={marker}
                className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm"
              >
                {marker}
              </span>
            ))}
          </div>
          {results.hasOminousAlert && (
            <p className="text-red-700 text-sm mt-3">
              3+ ominous markers detected. Clinical evaluation recommended.
            </p>
          )}
        </div>
      )}

      {/* Flagged by Category */}
      {flaggedCount > 0 && (
        <div>
          <h4 className="font-medium text-neutral-900 mb-4">
            Flagged Results by Category
          </h4>
          <div className="space-y-4">
            {LAB_CATEGORIES.map((category) => (
              <CategoryResultsSummary
                key={category.id}
                category={category}
                results={results.categorizedResults[category.id] || []}
              />
            ))}
          </div>
        </div>
      )}

      {/* All Normal Message */}
      {flaggedCount === 0 && totalMarkers > 0 && (
        <div className="bg-green-50 rounded-xl p-6 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg
              className="w-6 h-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h4 className="font-medium text-green-900">All Markers Normal</h4>
          <p className="text-green-700 text-sm mt-1">
            All {totalMarkers} markers are within their optimal ranges.
          </p>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  variant: 'neutral' | 'success' | 'info' | 'warning' | 'danger';
}

function StatCard({ label, value, variant }: StatCardProps) {
  const bgColors = {
    neutral: 'bg-neutral-50',
    success: 'bg-green-50',
    info: 'bg-blue-50',
    warning: 'bg-yellow-50',
    danger: 'bg-red-50',
  };

  const textColors = {
    neutral: 'text-neutral-900',
    success: 'text-green-900',
    info: 'text-blue-900',
    warning: 'text-yellow-900',
    danger: 'text-red-900',
  };

  return (
    <div className={`rounded-xl p-4 ${bgColors[variant]}`}>
      <p className={`text-2xl font-semibold ${textColors[variant]}`}>{value}</p>
      <p className="text-sm text-neutral-500">{label}</p>
    </div>
  );
}

// Compact summary for dashboard
export function CompactResultsSummary({
  results,
}: {
  results: LabCalculationResult;
}) {
  const flaggedCount = results.results.filter((r) => r.isFlagged).length;
  const totalMarkers = results.results.length;

  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="text-neutral-600">
        {totalMarkers} markers analyzed
      </span>
      {flaggedCount > 0 ? (
        <span className="text-yellow-600 font-medium">
          {flaggedCount} flagged
        </span>
      ) : (
        <span className="text-green-600 font-medium">All normal</span>
      )}
      {results.hasOminousAlert && (
        <span className="text-red-600 font-medium">
          {results.ominousCount} ominous
        </span>
      )}
    </div>
  );
}
