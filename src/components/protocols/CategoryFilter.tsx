'use client'

import type { FrequencyCategory } from '@/types/frequency'

interface CategoryFilterProps {
  selectedCategory: FrequencyCategory | 'all'
  categoryCounts?: Record<string, number>
  onCategoryChange: (category: FrequencyCategory | 'all') => void
  isLoading?: boolean
}

const CATEGORIES: Array<{ value: FrequencyCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'general', label: 'General' },
  { value: 'thyroid', label: 'Thyroid' },
  { value: 'diabetes', label: 'Diabetes' },
  { value: 'neurological', label: 'Neurological' },
  { value: 'hormones', label: 'Hormones' },
]

/**
 * Filter component for browsing frequencies by category
 */
export function CategoryFilter({
  selectedCategory,
  categoryCounts = {},
  onCategoryChange,
  isLoading = false,
}: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          onClick={() => onCategoryChange(cat.value)}
          disabled={isLoading}
          className={`
            px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap
            ${
              selectedCategory === cat.value
                ? 'bg-black dark:bg-black text-white dark:text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }
            ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {cat.label}
          <span className="ml-2 text-sm opacity-75">
            ({categoryCounts[cat.value] ?? 0})
          </span>
        </button>
      ))}
    </div>
  )
}
