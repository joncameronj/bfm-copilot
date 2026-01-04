'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { usePatients } from '@/hooks/usePatients'
import type { PatientWithStats } from '@/types/patient'
import { HugeiconsIcon } from '@hugeicons/react'
import { Search01Icon, Cancel01Icon } from '@hugeicons/core-free-icons'

interface PatientSearchModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (patient: { id: string; firstName: string; lastName: string }) => void
}

export function PatientSearchModal({ isOpen, onClose, onSelect }: PatientSearchModalProps) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setSearch('')
      setDebouncedSearch('')
    }
  }, [isOpen])

  const { patients, isLoading } = usePatients({
    search: debouncedSearch,
    status: 'active',
    sortBy: 'name',
    sortOrder: 'asc',
  })

  const handleSelect = (patient: PatientWithStats) => {
    onSelect({
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">Find Patient</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={20} color="currentColor" />
          </button>
        </div>

        {/* Search input */}
        <div className="p-4">
          <div className="relative">
            <HugeiconsIcon
              icon={Search01Icon}
              size={18}
              color="currentColor"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name..."
              className={cn(
                'w-full pl-10 pr-4 py-2.5 rounded-xl',
                'bg-neutral-100 text-neutral-900 placeholder:text-neutral-400',
                'focus:outline-none focus:ring-2 focus:ring-brand-blue/20',
                'transition-all duration-200'
              )}
            />
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-neutral-500">
              Searching...
            </div>
          ) : patients.length === 0 ? (
            <div className="p-4 text-center text-neutral-500">
              {debouncedSearch ? 'No patients found' : 'Type to search patients'}
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {patients.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => handleSelect(patient)}
                  className={cn(
                    'w-full px-4 py-3 text-left',
                    'hover:bg-neutral-50 transition-colors',
                    'focus:outline-none focus:bg-neutral-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-neutral-600">
                        {patient.firstName[0]}{patient.lastName[0]}
                      </span>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {patient.labCount} labs · {patient.conversationCount} conversations
                      </p>
                    </div>
                    {/* Status indicator */}
                    {patient.hasOminousAlerts && (
                      <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="p-3 border-t border-neutral-200 bg-neutral-50">
          <p className="text-xs text-neutral-500 text-center">
            Select a patient to work with
          </p>
        </div>
      </div>
    </div>
  )
}
