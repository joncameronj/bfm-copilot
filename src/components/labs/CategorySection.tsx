'use client';

import { useState } from 'react';
import type { LabMarker, MarkerResult, LabFormValues } from '@/types/labs';
import type { CategoryInfo } from '@/lib/labs/categories';
import { cn } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, PlusSignIcon, Tick02Icon, Alert01Icon, InformationCircleIcon } from '@hugeicons/core-free-icons';

interface CategorySectionProps {
  category: CategoryInfo;
  markers: LabMarker[];
  values: LabFormValues;
  results?: MarkerResult[];
  onValueChange: (_markerId: string, _value: number | null) => void;
  defaultExpanded?: boolean;
}

export function CategorySection({
  category,
  markers,
  values,
  results,
  onValueChange,
  defaultExpanded = false,
}: CategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Count flagged items
  const flaggedCount = results?.filter((r) => r.isFlagged).length || 0;
  const ominousCount = results?.filter((r) => r.isOminous).length || 0;
  // Count missing/empty markers
  const missingCount = markers.filter((m) => values[m.id] == null).length;

  if (markers.length === 0) return null;

  const getStatus = (result: MarkerResult | undefined) => {
    if (!result?.evaluation) return null;
    if (result.evaluation === 'normal') return 'optimal';
    return 'critical';
  };

  const getDelta = (result: MarkerResult | undefined) => {
    if (!result || result.delta === null || result.delta === undefined) return null;
    return result.delta.toFixed(1);
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'optimal':
        return 'text-green-600';
      case 'critical':
        return 'text-red-600';
      default:
        return 'text-neutral-400';
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'optimal':
        return <HugeiconsIcon icon={Tick02Icon} size={16} />;
      case 'critical':
        return <HugeiconsIcon icon={Alert01Icon} size={16} />;
      default:
        return null;
    }
  };

  const handleInputChange = (markerId: string, value: string) => {
    if (value === '') {
      onValueChange(markerId, null);
    } else {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        onValueChange(markerId, parsed);
      }
    }
  };

  return (
    <div className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="relative flex items-center justify-between p-6">
        <span className="bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 rounded-md px-3 py-1 text-base font-semibold whitespace-nowrap">
          {category.name}
        </span>
        <div className="flex w-full items-center ml-4">
          <div aria-hidden="true" className="w-full border-t border-neutral-200 dark:border-neutral-700" />
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              'inline-flex items-center gap-x-1.5 rounded-full',
              'bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50',
              'px-3 py-1.5 text-sm font-semibold whitespace-nowrap',
              'hover:bg-neutral-100 dark:hover:bg-neutral-700',
              'transition-colors'
            )}
          >
            {isExpanded ? (
              <HugeiconsIcon icon={ArrowDown01Icon} size={20} className="-ml-1 text-neutral-500 dark:text-neutral-400" />
            ) : (
              <HugeiconsIcon icon={PlusSignIcon} size={20} className="-ml-1 text-neutral-500 dark:text-neutral-400" />
            )}
            <span>{markers.length} markers</span>
            {missingCount > 0 && (
              <span className="ml-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded text-xs">
                {missingCount} missing
              </span>
            )}
            {ominousCount > 0 && (
              <span className="ml-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded text-xs">
                {ominousCount} ominous
              </span>
            )}
            {flaggedCount > 0 && ominousCount === 0 && (
              <span className="ml-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded text-xs">
                {flaggedCount} flagged
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="px-6 pb-6">
          {/* Table Header */}
          <div className="grid grid-cols-6 gap-4 p-4 rounded-lg mb-2 text-sm font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
            <div>Marker</div>
            <div className="text-center">Target Range</div>
            <div className="text-center">Value</div>
            <div className="text-center">Delta from Target</div>
            <div className="text-center">Evaluation</div>
            <div>Weakness / Possibilities</div>
          </div>

          {/* Marker Rows */}
          <div className="space-y-2">
            {markers.map((marker) => {
              const value = values[marker.id];
              const result = results?.find((r) => r.markerId === marker.id);
              const status = getStatus(result);
              const delta = getDelta(result);

              const isEmpty = value === null || value === undefined;

              return (
                <div
                  key={marker.id}
                  className={cn(
                    'grid grid-cols-6 gap-4 p-4 rounded-lg transition-colors',
                    'bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200/50 dark:hover:bg-neutral-600/50'
                  )}
                >
                  {/* Marker Name with Info Tooltip */}
                  <div className="font-medium text-neutral-900 dark:text-neutral-50 flex items-center gap-1.5">
                    <span>{marker.displayName}</span>
                    {marker.description && (
                      <div className="relative group">
                        <HugeiconsIcon
                          icon={InformationCircleIcon}
                          size={16}
                          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 cursor-help"
                        />
                        {/* Tooltip */}
                        <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover:block
                                        w-64 p-3 bg-neutral-900 text-white text-xs rounded-lg shadow-lg
                                        pointer-events-none">
                          {marker.description}
                        </div>
                      </div>
                    )}
                    {result?.isOminous && (
                      <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded">
                        Ominous
                      </span>
                    )}
                  </div>

                  {/* Target Range */}
                  <div className="text-center font-mono text-sm text-neutral-600 dark:text-neutral-400 flex items-center justify-center">
                    {marker.targetRange}
                  </div>

                  {/* Value Input */}
                  <div className="flex gap-1">
                    <input
                      type="number"
                      step="any"
                      placeholder="Enter"
                      value={value ?? ''}
                      onChange={(e) => handleInputChange(marker.id, e.target.value)}
                      className={cn(
                        'w-full text-center rounded-lg px-3 py-2 text-sm',
                        'bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600',
                        'focus:border-neutral-400 dark:focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 dark:focus:ring-neutral-100/20',
                        'text-neutral-900 dark:text-neutral-50 placeholder:text-neutral-400 dark:placeholder:text-neutral-500'
                      )}
                    />
                    {marker.unit && (
                      <div className="flex items-center px-2 rounded text-xs bg-neutral-100 dark:bg-neutral-600 text-neutral-500 dark:text-neutral-300 whitespace-nowrap">
                        {marker.unit}
                      </div>
                    )}
                  </div>

                  {/* Delta from Target */}
                  <div className="text-center font-mono text-sm text-neutral-600 dark:text-neutral-400 flex items-center justify-center">
                    {delta !== null ? (
                      <span className={cn(
                        parseFloat(delta) > 0 && 'text-red-600 dark:text-red-400',
                        parseFloat(delta) < 0 && 'text-blue-600 dark:text-blue-400',
                        parseFloat(delta) === 0 && 'text-green-600 dark:text-green-400'
                      )}>
                        {parseFloat(delta) > 0 ? '+' : ''}{delta}
                      </span>
                    ) : (
                      '-'
                    )}
                  </div>

                  {/* Evaluation */}
                  <div className="text-center flex items-center justify-center">
                    {status && (
                      <div className={cn('flex items-center gap-1', getStatusColor(status))}>
                        {getStatusIcon(status)}
                        <span className="text-sm font-medium capitalize">
                          {status === 'optimal' ? 'Normal' : 'High/Low'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Weakness / Possibilities */}
                  <div className="text-sm text-neutral-500 dark:text-neutral-400 flex items-center">
                    {result?.weaknessText || '-'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Summary section showing only flagged results
export function CategoryResultsSummary({
  category,
  results,
}: {
  category: CategoryInfo;
  results: MarkerResult[];
}) {
  const flaggedResults = results.filter((r) => r.isFlagged);

  if (flaggedResults.length === 0) return null;

  return (
    <div className="mb-4">
      <h4 className="text-sm font-medium text-neutral-600 mb-2">
        {category.name}
      </h4>
      <div className="space-y-2">
        {flaggedResults.map((result) => (
          <div
            key={result.markerId}
            className={cn(
              'flex justify-between items-center p-3 rounded-lg',
              result.evaluation === 'low' && 'bg-blue-50',
              result.evaluation === 'moderate' && 'bg-yellow-50',
              result.evaluation === 'high' && 'bg-red-50'
            )}
          >
            <div>
              <p className="font-medium text-neutral-900">
                {result.displayName}
                {result.isOminous && (
                  <span className="ml-2 text-xs text-red-600">(Ominous)</span>
                )}
              </p>
              <p className="text-sm text-neutral-500">
                Value: {result.value} {result.unit} (Target: {result.targetRange})
              </p>
            </div>
            <span
              className={cn(
                'text-xs font-medium px-2 py-1 rounded-full capitalize',
                result.evaluation === 'low' && 'bg-blue-100 text-blue-800',
                result.evaluation === 'moderate' && 'bg-yellow-100 text-yellow-800',
                result.evaluation === 'high' && 'bg-red-100 text-red-800'
              )}
            >
              {result.evaluation}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
