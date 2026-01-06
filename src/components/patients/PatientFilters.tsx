'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import { GridViewIcon, ListViewIcon } from '@hugeicons/core-free-icons'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { PatientFilters as PatientFiltersType, PatientViewMode } from '@/types/patient'

interface PatientFiltersProps {
  filters: PatientFiltersType
  onChange: (filters: PatientFiltersType) => void
  viewMode: PatientViewMode
  onViewModeChange: (mode: PatientViewMode) => void
}

export function PatientFilters({ filters, onChange, viewMode, onViewModeChange }: PatientFiltersProps) {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, search: e.target.value })
  }

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...filters, status: e.target.value as PatientFiltersType['status'] })
  }

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [sortBy, sortOrder] = e.target.value.split('-') as [
      PatientFiltersType['sortBy'],
      PatientFiltersType['sortOrder']
    ]
    onChange({ ...filters, sortBy, sortOrder })
  }

  const currentSort = `${filters.sortBy || 'created'}-${filters.sortOrder || 'desc'}`

  return (
    <div className="flex flex-wrap gap-4 items-center">
      <div className="flex-1 min-w-[200px]">
        <Input
          placeholder="Search patients..."
          value={filters.search || ''}
          onChange={handleSearchChange}
          className="bg-transparent border border-neutral-300 dark:border-neutral-600"
        />
      </div>

      <div className="w-40">
        <Select
          value={filters.status || 'active'}
          onChange={handleStatusChange}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </Select>
      </div>

      <div className="w-48">
        <Select
          value={currentSort}
          onChange={handleSortChange}
        >
          <option value="created-desc">Date Added (Newest)</option>
          <option value="created-asc">Date Added (Oldest)</option>
          <option value="age-asc">Age (Youngest)</option>
          <option value="age-desc">Age (Oldest)</option>
          <option value="name-asc">Name (A-Z)</option>
          <option value="name-desc">Name (Z-A)</option>
          <option value="lastVisit-desc">Recent Activity</option>
        </Select>
      </div>

      <div className="flex border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => onViewModeChange('card')}
          className={`p-2 transition-colors ${
            viewMode === 'card'
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
              : 'bg-white text-neutral-600 hover:bg-neutral-50 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700'
          }`}
          aria-label="Card view"
        >
          <HugeiconsIcon icon={GridViewIcon} size={20} color="currentColor" />
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange('list')}
          className={`p-2 transition-colors ${
            viewMode === 'list'
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
              : 'bg-white text-neutral-600 hover:bg-neutral-50 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700'
          }`}
          aria-label="List view"
        >
          <HugeiconsIcon icon={ListViewIcon} size={20} color="currentColor" />
        </button>
      </div>
    </div>
  )
}
