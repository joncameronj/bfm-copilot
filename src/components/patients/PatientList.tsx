'use client'

import { useState } from 'react'
import { PatientCard } from './PatientCard'
import { PatientListRow } from './PatientListRow'
import { PatientFilters } from './PatientFilters'
import { Button } from '@/components/ui/Button'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { usePatients } from '@/hooks/usePatients'
import type { PatientFilters as PatientFiltersType, PatientViewMode } from '@/types/patient'
import Link from 'next/link'

export function PatientList() {
  const [filters, setFilters] = useState<PatientFiltersType>({
    status: 'active',
    sortBy: 'created',
    sortOrder: 'desc',
  })
  const [viewMode, setViewMode] = useState<PatientViewMode>('card')

  const { patients, isLoading, error, refetch } = usePatients(filters)

  if (error) {
    return (
      <div className="bg-red-50 rounded-2xl p-6 text-center">
        <p className="text-red-600 mb-4">Failed to load patients</p>
        <Button variant="secondary" onClick={() => refetch()}>
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-6">
        <PatientFilters
          filters={filters}
          onChange={setFilters}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </div>

      {/* Patient Grid/List */}
      {isLoading ? (
        viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-4 py-3 border-b border-neutral-100 last:border-b-0">
                <div className="animate-pulse flex items-center gap-4">
                  <div className="flex-1">
                    <div className="h-4 bg-neutral-200 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-neutral-100 rounded w-1/2"></div>
                  </div>
                  <div className="h-4 bg-neutral-100 rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : patients.length === 0 ? (
        <div className="bg-neutral-50 rounded-2xl p-12 text-center">
          <p className="text-neutral-500 mb-4">
            {filters.search
              ? 'No patients found matching your search'
              : 'No patients yet'}
          </p>
          {!filters.search && (
            <Link href="/patients/new">
              <Button>Add First Patient</Button>
            </Link>
          )}
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((patient) => (
            <PatientCard key={patient.id} patient={patient} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          {patients.map((patient) => (
            <PatientListRow key={patient.id} patient={patient} />
          ))}
        </div>
      )}
    </div>
  )
}
