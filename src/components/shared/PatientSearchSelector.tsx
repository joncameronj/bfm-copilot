'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { HugeiconsIcon } from '@hugeicons/react'
import { Search01Icon, Cancel01Icon, UserIcon, Clock01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { calculateAge } from '@/lib/utils'

interface Patient {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string | Date
  gender: 'male' | 'female'
}

interface PatientSearchSelectorProps {
  value?: string
  onChange: (patientId: string | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

const RECENT_PATIENTS_KEY = 'recentPatients'
const MAX_RECENT = 5

export function PatientSearchSelector({
  value,
  onChange,
  placeholder = 'Search patients...',
  disabled = false,
  className,
}: PatientSearchSelectorProps) {
  const searchParams = useSearchParams()
  const urlPatientId = searchParams.get('patient')

  const [patients, setPatients] = useState<Patient[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [recentPatientIds, setRecentPatientIds] = useState<string[]>([])

  // Load recent patients from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_PATIENTS_KEY)
    if (stored) {
      try {
        setRecentPatientIds(JSON.parse(stored))
      } catch {
        setRecentPatientIds([])
      }
    }
  }, [])

  // Fetch all patients
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const response = await fetch('/api/patients?status=active&sortBy=name&sortOrder=asc')
        if (response.ok) {
          const { data } = await response.json()
          setPatients(data || [])
        }
      } catch (error) {
        console.error('Failed to fetch patients:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPatients()
  }, [])

  // Auto-select from URL param on mount
  useEffect(() => {
    if (urlPatientId && !value && patients.length > 0) {
      const patient = patients.find(p => p.id === urlPatientId)
      if (patient) {
        onChange(urlPatientId)
      }
    }
  }, [urlPatientId, value, patients, onChange])

  // Selected patient
  const selectedPatient = useMemo(() => {
    if (!value) return null
    return patients.find(p => p.id === value) || null
  }, [value, patients])

  // Recent patients (filtered to only show valid ones)
  const recentPatients = useMemo(() => {
    return recentPatientIds
      .map(id => patients.find(p => p.id === id))
      .filter((p): p is Patient => p !== undefined)
      .slice(0, MAX_RECENT)
  }, [recentPatientIds, patients])

  // Filtered patients by search
  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return []
    const query = searchQuery.toLowerCase()
    return patients.filter(p =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(query)
    ).slice(0, 10)
  }, [searchQuery, patients])

  // Add to recent patients
  const addToRecent = useCallback((patientId: string) => {
    setRecentPatientIds(prev => {
      const updated = [patientId, ...prev.filter(id => id !== patientId)].slice(0, MAX_RECENT)
      localStorage.setItem(RECENT_PATIENTS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const handleSelect = useCallback((patient: Patient) => {
    onChange(patient.id)
    addToRecent(patient.id)
    setSearchQuery('')
    setIsFocused(false)
  }, [onChange, addToRecent])

  const handleClear = useCallback(() => {
    onChange(undefined)
    setSearchQuery('')
  }, [onChange])

  // Show dropdown when focused and no patient selected
  const showDropdown = isFocused && !selectedPatient

  if (isLoading) {
    return (
      <div className={cn('bg-neutral-50 rounded-xl p-4', className)}>
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-10 h-10 bg-neutral-200 rounded-full" />
          <div className="flex-1">
            <div className="h-4 bg-neutral-200 rounded w-32" />
          </div>
        </div>
      </div>
    )
  }

  // Selected patient view
  if (selectedPatient) {
    return (
      <div className={cn('bg-neutral-50 rounded-xl p-4', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <HugeiconsIcon icon={UserIcon} size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-neutral-900">
                {selectedPatient.firstName} {selectedPatient.lastName}
              </p>
              <p className="text-sm text-neutral-500">
                {calculateAge(new Date(selectedPatient.dateOfBirth))} years • {selectedPatient.gender}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="text-neutral-400 hover:text-neutral-600 p-2 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </button>
        </div>
      </div>
    )
  }

  // Search view
  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <HugeiconsIcon
          icon={Search01Icon}
          size={20}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'w-full pl-12 pr-4 py-3 rounded-xl border border-neutral-200',
            'bg-white text-neutral-900 placeholder:text-neutral-400',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
            'transition-all',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        />
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-neutral-200 shadow-lg z-50 max-h-80 overflow-y-auto">
          {/* Search results */}
          {searchQuery && filteredPatients.length > 0 && (
            <div className="p-2">
              {filteredPatients.map(patient => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => handleSelect(patient)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <HugeiconsIcon icon={UserIcon} size={16} className="text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-neutral-900 truncate">
                      {patient.firstName} {patient.lastName}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {calculateAge(new Date(patient.dateOfBirth))} years • {patient.gender}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {searchQuery && filteredPatients.length === 0 && (
            <div className="p-4 text-center text-neutral-500 text-sm">
              No patients found matching &quot;{searchQuery}&quot;
            </div>
          )}

          {/* Recent patients */}
          {!searchQuery && recentPatients.length > 0 && (
            <div className="p-2">
              <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wide">
                <HugeiconsIcon icon={Clock01Icon} size={14} />
                Recent Patients
              </div>
              {recentPatients.map(patient => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => handleSelect(patient)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                    <HugeiconsIcon icon={UserIcon} size={16} className="text-neutral-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-neutral-900 truncate">
                      {patient.firstName} {patient.lastName}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {calculateAge(new Date(patient.dateOfBirth))} years • {patient.gender}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* All patients (when no search query and patients exist) */}
          {!searchQuery && patients.length > 0 && (
            <div className="p-2">
              <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wide">
                <HugeiconsIcon icon={UserIcon} size={14} />
                All Patients
              </div>
              {patients.map(patient => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => handleSelect(patient)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <HugeiconsIcon icon={UserIcon} size={16} className="text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-neutral-900 truncate">
                      {patient.firstName} {patient.lastName}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {calculateAge(new Date(patient.dateOfBirth))} years • {patient.gender}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Empty state - no patients exist */}
          {!searchQuery && patients.length === 0 && (
            <div className="p-4 text-center text-neutral-500 text-sm">
              No patients available. Create a patient first.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
