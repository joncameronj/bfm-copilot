'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ProtocolCard } from './ProtocolCard'
import { ProtocolsTable } from './ProtocolsTable'
import { ProtocolFilters } from './ProtocolFilters'
import { NoPatientsEmptyState } from './NoPatientsEmptyState'
import { Button } from '@/components/ui/Button'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useProtocols } from '@/hooks/useProtocols'
import type { ProtocolFilters as ProtocolFiltersType } from '@/types/protocol'
import Link from 'next/link'

interface ProtocolListProps {
  viewMode?: 'table' | 'cards'
}

export function ProtocolList({ viewMode = 'table' }: ProtocolListProps) {
  const router = useRouter()
  const [filters, setFilters] = useState<ProtocolFiltersType>({
    status: 'all',
    category: 'all',
  })
  const [hasPatients, setHasPatients] = useState<boolean | null>(null)
  const [checkingPatients, setCheckingPatients] = useState(true)

  const { protocols, isLoading, error, refetch } = useProtocols(filters)

  // Check if user has any patients
  useEffect(() => {
    const checkPatients = async () => {
      try {
        const res = await fetch('/api/patients?limit=1')
        if (res.ok) {
          const data = await res.json()
          setHasPatients(data.data && data.data.length > 0)
        }
      } catch (err) {
        console.error('Failed to check patients:', err)
        setHasPatients(true) // Default to true on error
      } finally {
        setCheckingPatients(false)
      }
    }
    checkPatients()
  }, [])

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 rounded-2xl p-6 text-center">
        <p className="text-red-600 dark:text-red-400 mb-4">Failed to load protocols</p>
        <Button variant="secondary" onClick={() => refetch()}>
          Try Again
        </Button>
      </div>
    )
  }

  // Show empty state if user has no patients
  if (!checkingPatients && hasPatients === false) {
    return <NoPatientsEmptyState />
  }

  const handleProtocolClick = (id: string) => {
    router.push(`/protocols/${id}`)
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-6">
        <ProtocolFilters filters={filters} onChange={setFilters} />
      </div>

      {/* Protocol List */}
      {isLoading || checkingPatients ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : protocols.length === 0 ? (
        <div className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-700 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-neutral-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-2">
              {filters.search ? 'No protocols found' : 'No protocols yet'}
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              {filters.search
                ? 'No protocols found matching your search'
                : 'Protocols are generated from diagnostic uploads attached to patient profiles. Start by adding a patient.'}
            </p>
            {!filters.search && (
              <Link href="/patients/new">
                <Button>Add Your First Patient</Button>
              </Link>
            )}
          </div>
        </div>
      ) : viewMode === 'table' ? (
        <ProtocolsTable protocols={protocols} onProtocolClick={handleProtocolClick} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {protocols.map((protocol) => (
            <ProtocolCard key={protocol.id} protocol={protocol} />
          ))}
        </div>
      )}
    </div>
  )
}
