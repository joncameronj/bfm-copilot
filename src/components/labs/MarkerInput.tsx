'use client';

import { useState } from 'react';
import type { LabMarker, MarkerResult } from '@/types/labs';
import { cn } from '@/lib/utils';
import { OminousIndicator } from './OminousAlert';

interface MarkerInputProps {
  marker: LabMarker;
  value: number | null | undefined;
  result?: MarkerResult;
  onChange: (value: number | null) => void;
  showResult?: boolean;
  isEmpty?: boolean;
}

export function MarkerInput({
  marker,
  value,
  result,
  onChange,
  showResult = true,
  isEmpty = false,
}: MarkerInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const getStatusColor = () => {
    // isEmpty styling takes precedence when there's no value
    if (isEmpty && (value === null || value === undefined)) {
      return 'bg-red-50 border-2 border-red-400';
    }
    if (!result || !showResult) return 'bg-neutral-100';
    switch (result.evaluation) {
      case 'low':
        return 'bg-blue-50';
      case 'normal':
        return 'bg-green-50';
      case 'moderate':
        return 'bg-yellow-50';
      case 'high':
        return 'bg-red-50';
      default:
        return 'bg-neutral-100';
    }
  };

  const getStatusBadge = () => {
    if (!result?.evaluation || !showResult) return null;

    const badgeStyles: Record<string, string> = {
      low: 'bg-blue-100 text-blue-800',
      normal: 'bg-green-100 text-green-800',
      moderate: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800',
    };

    const labels: Record<string, string> = {
      low: 'Low',
      normal: 'Normal',
      moderate: 'Moderate',
      high: 'High',
    };

    return (
      <span
        className={cn(
          'text-xs font-medium px-2 py-1 rounded-full',
          badgeStyles[result.evaluation]
        )}
      >
        {labels[result.evaluation]}
      </span>
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      onChange(null);
    } else {
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        onChange(parsed);
      }
    }
  };

  return (
    <div
      className={cn(
        'rounded-xl p-4 transition-colors',
        getStatusColor(),
        isFocused && 'ring-2 ring-neutral-900/20'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <label className="font-medium text-neutral-900 block truncate">
            {marker.displayName}
          </label>
          <p className="text-sm text-neutral-500">
            Target: {marker.targetRange}
            {marker.unit && ` ${marker.unit}`}
          </p>
        </div>
        {getStatusBadge()}
      </div>

      {/* Input */}
      <div className="relative">
        <input
          type="number"
          step="any"
          value={value ?? ''}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Enter value"
          className={cn(
            'w-full bg-white/80 text-neutral-900 rounded-lg px-4 py-3 text-lg',
            'placeholder:text-neutral-400 focus:outline-none focus:ring-2',
            'focus:ring-neutral-900/20 transition-all duration-200'
          )}
        />
        {marker.unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">
            {marker.unit}
          </span>
        )}
      </div>

      {/* Delta display */}
      {result?.delta !== null && result?.delta !== undefined && showResult && (
        <p className="text-sm text-neutral-500 mt-2">
          Delta: {result.delta > 0 ? '+' : ''}
          {result.delta}
        </p>
      )}

      {/* Ominous indicator */}
      {result?.isOminous && showResult && (
        <OminousIndicator markerName={marker.name} />
      )}

      {/* Weakness/Possibilities */}
      {result?.weaknessText && showResult && (
        <details className="mt-2">
          <summary className="text-sm text-neutral-600 cursor-pointer hover:text-neutral-900">
            View weakness/possibilities
          </summary>
          <p className="text-sm text-neutral-700 mt-2 p-2 bg-white/50 rounded-lg">
            {result.weaknessText}
          </p>
        </details>
      )}
    </div>
  );
}

// Compact version for summary view
export function MarkerResultCard({ result }: { result: MarkerResult }) {
  const getStatusColor = () => {
    switch (result.evaluation) {
      case 'low':
        return 'border-l-4 border-l-blue-500';
      case 'normal':
        return 'border-l-4 border-l-green-500';
      case 'moderate':
        return 'border-l-4 border-l-yellow-500';
      case 'high':
        return 'border-l-4 border-l-red-500';
      default:
        return 'border-l-4 border-l-neutral-300';
    }
  };

  return (
    <div
      className={cn(
        'bg-neutral-50 rounded-lg p-3 flex justify-between items-center',
        getStatusColor()
      )}
    >
      <div>
        <p className="font-medium text-neutral-900">{result.displayName}</p>
        <p className="text-sm text-neutral-500">
          {result.value} {result.unit && `${result.unit}`}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium capitalize">{result.evaluation || 'Pending'}</p>
        <p className="text-xs text-neutral-400">{result.targetRange}</p>
      </div>
    </div>
  );
}
