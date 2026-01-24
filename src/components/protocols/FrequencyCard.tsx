'use client'

import { Checkbox } from '@/components/ui/Checkbox'
import type { ApprovedFrequency, FrequencyCategory } from '@/types/frequency'

interface FrequencyCardProps {
  frequency: ApprovedFrequency
  isSelected: boolean
  onToggle: (frequency: ApprovedFrequency) => void
}

const CATEGORY_COLORS: Record<FrequencyCategory, string> = {
  general: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-400',
  thyroid: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  diabetes: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  neurological: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
  hormones: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400',
}

/**
 * Card displaying a single approved frequency with selection checkbox
 */
export function FrequencyCard({
  frequency,
  isSelected,
  onToggle,
}: FrequencyCardProps) {
  return (
    <div
      onClick={() => onToggle(frequency)}
      className={`
        relative p-4 rounded-xl cursor-pointer transition-all duration-200
        ${
          isSelected
            ? 'bg-blue-50 dark:bg-blue-900/20'
            : 'bg-neutral-50 dark:bg-neutral-900/50 hover:bg-neutral-100 dark:hover:bg-neutral-900'
        }
      `}
    >
      {/* Checkbox in top-right */}
      <div className="absolute top-3 right-3">
        <Checkbox
          checked={isSelected}
          onChange={() => onToggle(frequency)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Content */}
      <div className="pr-8">
        {/* Category Badge */}
        <div className="inline-block mb-3">
          <span className={`px-2 py-1 rounded text-xs font-semibold uppercase tracking-wide ${CATEGORY_COLORS[frequency.category]}`}>
            {frequency.category}
          </span>
        </div>

        {/* Frequency Name */}
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1 line-clamp-2">
          {frequency.name}
        </h3>

        {/* Description */}
        {frequency.description && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-2">
            {frequency.description}
          </p>
        )}

        {/* Aliases */}
        {frequency.aliases && frequency.aliases.length > 0 && (
          <p className="text-xs text-neutral-500 dark:text-neutral-500">
            <span className="font-medium">Also known as:</span> {frequency.aliases.join(', ')}
          </p>
        )}
      </div>
    </div>
  )
}
