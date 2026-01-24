'use client'

import { useState, useCallback, useMemo } from 'react'
import { Input } from '@/components/ui/Input'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { FrequencyCard } from './FrequencyCard'
import { CategoryFilter } from './CategoryFilter'
import { useApprovedFrequencies } from '@/hooks/useApprovedFrequencies'
import type { ApprovedFrequency, FrequencyCategory } from '@/types/frequency'

interface FrequencyBrowserProps {
  selectedFrequencies: ApprovedFrequency[]
  onFrequencyToggle: (frequency: ApprovedFrequency) => void
}

/**
 * Browse and filter approved frequencies
 */
export function FrequencyBrowser({
  selectedFrequencies,
  onFrequencyToggle,
}: FrequencyBrowserProps) {
  const [selectedCategory, setSelectedCategory] = useState<FrequencyCategory | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search input (300ms)
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value)
  }, [])

  // Fetch ALL frequencies for accurate category counts (not filtered by current selection)
  const { frequencies: allFrequencies, isLoading: allLoading } = useApprovedFrequencies({
    category: 'all',
    search: '',
    isActive: true,
    limit: 500, // Fetch all frequencies for accurate category counts
  })

  // Fetch frequencies with current filters for display
  const { frequencies, isLoading, error } = useApprovedFrequencies({
    category: selectedCategory,
    search: debouncedSearch,
    isActive: true,
    limit: 500, // Ensure we display all frequencies in each category
  })

  // Calculate category counts from ALL frequencies (not filtered)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: allFrequencies.length,
      general: 0,
      thyroid: 0,
      diabetes: 0,
      neurological: 0,
      hormones: 0,
    }

    allFrequencies.forEach((f) => {
      counts[f.category] = (counts[f.category] || 0) + 1
    })

    return counts
  }, [allFrequencies])

  // Apply client-side search filtering
  const filteredFrequencies = useMemo(() => {
    if (!searchTerm) return frequencies

    const searchLower = searchTerm.toLowerCase()
    return frequencies.filter(
      (f) =>
        f.name.toLowerCase().includes(searchLower) ||
        f.aliases?.some((a) => a.toLowerCase().includes(searchLower)) ||
        f.description?.toLowerCase().includes(searchLower)
    )
  }, [frequencies, searchTerm])

  const isFrequencySelected = useCallback(
    (frequencyId: string) => selectedFrequencies.some((f) => f.id === frequencyId),
    [selectedFrequencies]
  )

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div>
        <Input
          type="text"
          placeholder="Search by frequency name..."
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full !bg-transparent border-2 border-neutral-300 dark:border-neutral-700"
          disabled={isLoading}
        />
      </div>

      {/* Category Filter */}
      <div>
        <CategoryFilter
          selectedCategory={selectedCategory}
          categoryCounts={categoryCounts}
          onCategoryChange={setSelectedCategory}
          isLoading={isLoading}
        />
      </div>

      {/* Frequencies Grid */}
      <div>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 text-center">
            <p className="text-red-600 dark:text-red-400">
              Failed to load frequencies. Please try again.
            </p>
          </div>
        ) : filteredFrequencies.length === 0 ? (
          <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-12 text-center">
            <p className="text-neutral-600 dark:text-neutral-400">
              {frequencies.length === 0
                ? 'No approved frequencies available'
                : 'No frequencies match your search'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFrequencies.map((frequency) => (
              <FrequencyCard
                key={frequency.id}
                frequency={frequency}
                isSelected={isFrequencySelected(frequency.id)}
                onToggle={onFrequencyToggle}
              />
            ))}
          </div>
        )}
      </div>

      {/* Results Count */}
      {!isLoading && filteredFrequencies.length > 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center">
          Showing {filteredFrequencies.length} of {frequencies.length} frequencies
        </p>
      )}
    </div>
  )
}
