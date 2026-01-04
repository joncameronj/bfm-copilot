'use client'

import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { ProtocolFilters as ProtocolFiltersType, ProtocolStatus, ProtocolCategory } from '@/types/protocol'
import { STATUS_LABELS, CATEGORY_LABELS } from '@/types/protocol'

interface ProtocolFiltersProps {
  filters: ProtocolFiltersType
  onChange: (filters: ProtocolFiltersType) => void
}

export function ProtocolFilters({ filters, onChange }: ProtocolFiltersProps) {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, search: e.target.value })
  }

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as ProtocolStatus | 'all'
    onChange({ ...filters, status: value })
  }

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as ProtocolCategory | 'all'
    onChange({ ...filters, category: value })
  }

  return (
    <div className="flex flex-wrap gap-4">
      <div className="flex-1 min-w-[200px]">
        <Input
          placeholder="Search protocols..."
          value={filters.search || ''}
          onChange={handleSearchChange}
        />
      </div>

      <div className="w-40">
        <Select
          value={filters.status || 'all'}
          onChange={handleStatusChange}
        >
          <option value="all">All Status</option>
          {(Object.keys(STATUS_LABELS) as ProtocolStatus[]).map(status => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>

      <div className="w-44">
        <Select
          value={filters.category || 'all'}
          onChange={handleCategoryChange}
        >
          <option value="all">All Categories</option>
          {(Object.keys(CATEGORY_LABELS) as ProtocolCategory[]).map(category => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}
