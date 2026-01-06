'use client'

import { useState } from 'react'
import { PatientCard } from './PatientCard'
import { PatientListRow } from './PatientListRow'
import { PatientFilters } from './PatientFilters'
import { Button } from '@/components/ui/Button'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { usePatients, usePatientMutations } from '@/hooks/usePatients'
import type { PatientFilters as PatientFiltersType, PatientViewMode } from '@/types/patient'
import Link from 'next/link'

export function PatientList() {
  const [filters, setFilters] = useState<PatientFiltersType>({
    status: 'active',
    sortBy: 'created',
    sortOrder: 'desc',
  })
  const [viewMode, setViewMode] = useState<PatientViewMode>('card')
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedPatients, setSelectedPatients] = useState<Set<string>>(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const { patients, isLoading, error, refetch } = usePatients(filters)
  const { deletePatient } = usePatientMutations()

  const handleSelectPatient = (patientId: string, selected: boolean) => {
    const newSelected = new Set(selectedPatients)
    if (selected) {
      newSelected.add(patientId)
    } else {
      newSelected.delete(patientId)
    }
    setSelectedPatients(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedPatients.size === patients.length) {
      setSelectedPatients(new Set())
    } else {
      setSelectedPatients(new Set(patients.map(p => p.id)))
    }
  }

  const handleCancelSelection = () => {
    setSelectionMode(false)
    setSelectedPatients(new Set())
  }

  const handleDeleteClick = () => {
    if (selectedPatients.size > 0) {
      setShowDeleteModal(true)
    }
  }

  const handleFirstConfirm = () => {
    setShowDeleteModal(false)
    setShowConfirmModal(true)
    setDeleteConfirmText('')
  }

  const handleFinalDelete = async () => {
    if (deleteConfirmText !== 'DELETE') return

    setIsDeleting(true)
    try {
      // Delete all selected patients
      await Promise.all(
        Array.from(selectedPatients).map(id => deletePatient(id))
      )
      setShowConfirmModal(false)
      setSelectionMode(false)
      setSelectedPatients(new Set())
      setDeleteConfirmText('')
      refetch()
    } catch (err) {
      console.error('Failed to delete patients:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  const selectedPatientNames = patients
    .filter(p => selectedPatients.has(p.id))
    .map(p => `${p.firstName} ${p.lastName}`)

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

      {/* Selection Mode Controls */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!selectionMode ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectionMode(true)}
              disabled={patients.length === 0}
            >
              Select
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedPatients.size === patients.length ? 'Deselect All' : 'Select All'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelSelection}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
        {selectionMode && selectedPatients.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-500">
              {selectedPatients.size} selected
            </span>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteClick}
            >
              Delete Selected
            </Button>
          </div>
        )}
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
            <PatientCard
              key={patient.id}
              patient={patient}
              selectable={selectionMode}
              selected={selectedPatients.has(patient.id)}
              onSelect={handleSelectPatient}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          {patients.map((patient) => (
            <PatientListRow key={patient.id} patient={patient} />
          ))}
        </div>
      )}

      {/* First Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Patients"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-neutral-600 dark:text-neutral-400">
            Are you sure you want to delete {selectedPatients.size} patient{selectedPatients.size > 1 ? 's' : ''}?
          </p>
          <div className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-3 max-h-32 overflow-y-auto">
            <ul className="text-sm text-neutral-700 dark:text-neutral-300 space-y-1">
              {selectedPatientNames.map((name, i) => (
                <li key={i} className="font-medium">{name}</li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-red-600 dark:text-red-400">
            This action will deactivate these patient records.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleFirstConfirm}>
              Yes, Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Second Delete Confirmation Modal (Type DELETE) */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false)
          setDeleteConfirmText('')
        }}
        title="Confirm Deletion"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-neutral-600 dark:text-neutral-400">
            To confirm deletion of {selectedPatients.size} patient{selectedPatients.size > 1 ? 's' : ''}, type <span className="font-bold text-neutral-900 dark:text-neutral-50">DELETE</span> below:
          </p>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="font-mono"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowConfirmModal(false)
                setDeleteConfirmText('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleFinalDelete}
              disabled={deleteConfirmText !== 'DELETE'}
              isLoading={isDeleting}
            >
              Delete Patients
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
