'use client'

import { useState, useMemo, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { PatientCard } from '@/components/patients/PatientCard'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { usePatients } from '@/hooks/usePatients'
import type { PatientWithStats } from '@/types/patient'

interface PatientSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  selectedPatientId?: string
  onSelect: (patientId: string, patientName: string) => void
}

/**
 * Full-page modal for selecting a patient with cards view
 * Shows "Recent Patients" at top and "All Patients" below
 */
export function PatientSelectorModal({
  isOpen,
  onClose,
  selectedPatientId,
  onSelect,
}: PatientSelectorModalProps) {
  const [search, setSearch] = useState('')
  const [tempSelectedId, setTempSelectedId] = useState<string | undefined>(selectedPatientId)

  // Fetch all active patients
  const { patients, isLoading } = usePatients({
    status: 'active',
    sortBy: 'created',
    sortOrder: 'desc',
  })

  // Reset temp selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setTempSelectedId(selectedPatientId)
      setSearch('')
    }
  }, [isOpen, selectedPatientId])

  // Filter patients based on search
  const filteredPatients = useMemo(() => {
    if (!search.trim()) return patients
    const searchLower = search.toLowerCase()
    return patients.filter((p) =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchLower) ||
      p.chiefComplaints?.toLowerCase().includes(searchLower)
    )
  }, [patients, search])

  // Recent patients: last 6 most recently created/updated
  const recentPatients = useMemo(() => {
    if (search.trim()) return [] // Hide recent when searching
    return patients.slice(0, 6)
  }, [patients, search])

  // All patients (excluding those shown in recent when not searching)
  const allPatients = useMemo(() => {
    if (search.trim()) return filteredPatients
    return patients.slice(6)
  }, [patients, filteredPatients, search])

  const handlePatientSelect = (patientId: string, selected: boolean) => {
    setTempSelectedId(selected ? patientId : undefined)
  }

  const handleConfirm = () => {
    if (tempSelectedId) {
      const patient = patients.find((p) => p.id === tempSelectedId)
      if (patient) {
        onSelect(patient.id, `${patient.firstName} ${patient.lastName}`)
      }
    }
  }

  const handleClose = () => {
    setSearch('')
    onClose()
  }

  const selectedPatient = patients.find((p) => p.id === tempSelectedId)

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Select Patient" size="3xl">
      <div className="flex flex-col h-[70vh]">
        {/* Search Input */}
        <div className="relative mb-6">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <Input
            type="text"
            placeholder="Search patients by name or condition..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            autoFocus
          />
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pr-2 -mr-2">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : patients.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-neutral-500 dark:text-neutral-400">No patients found</p>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-neutral-500 dark:text-neutral-400">
                No patients matching &quot;{search}&quot;
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Recent Patients Section */}
              {recentPatients.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-4">
                    Recent Patients
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recentPatients.map((patient) => (
                      <PatientCard
                        key={patient.id}
                        patient={patient}
                        selectable
                        selected={tempSelectedId === patient.id}
                        onSelect={handlePatientSelect}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* All Patients Section */}
              {allPatients.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-4">
                    {search.trim() ? 'Search Results' : 'All Patients'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allPatients.map((patient) => (
                      <PatientCard
                        key={patient.id}
                        patient={patient}
                        selectable
                        selected={tempSelectedId === patient.id}
                        onSelect={handlePatientSelect}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Footer with Selection Summary and Actions */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-neutral-200 dark:border-neutral-700">
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            {selectedPatient ? (
              <span>
                Selected: <span className="font-medium text-neutral-900 dark:text-neutral-100">{selectedPatient.firstName} {selectedPatient.lastName}</span>
              </span>
            ) : (
              <span>No patient selected</span>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!tempSelectedId}>
              Select Patient
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
