'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Search01Icon,
  Cancel01Icon,
  UserIcon,
  Clock01Icon,
  Tick02Icon,
  AlertCircleIcon,
  Add01Icon,
  AiMagicIcon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { calculateAge } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

interface Patient {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string | Date
  gender: 'male' | 'female' | 'other'
}

interface DiagnosticSummary {
  patientId: string
  diagnosticTypes: string[]
  hasAnalysis: boolean
  pendingUploads: number
  totalUploads: number
}

interface PatientProtocolSelectorProps {
  className?: string
}

const RECENT_PATIENTS_KEY = 'recentPatients'
const MAX_RECENT = 5

const DIAGNOSTIC_LABELS: Record<string, { label: string; shortLabel: string }> = {
  d_pulse: { label: 'D-Pulse', shortLabel: 'D-Pulse' },
  hrv: { label: 'Heart Rate Variability', shortLabel: 'HRV' },
  urinalysis: { label: 'Urinalysis', shortLabel: 'UA' },
  nes_scan: { label: 'NES Scan', shortLabel: 'NES' },
  mold_toxicity: { label: 'Mold Toxicity', shortLabel: 'Mold' },
  blood_panel: { label: 'Blood Panel', shortLabel: 'Blood' },
  other: { label: 'Other', shortLabel: 'Other' },
}

// Core diagnostics that should always be shown
const CORE_DIAGNOSTICS = ['hrv', 'urinalysis', 'blood_panel', 'd_pulse', 'nes_scan', 'mold_toxicity']

export function PatientProtocolSelector({ className }: PatientProtocolSelectorProps) {
  const router = useRouter()
  const [patients, setPatients] = useState<Patient[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [recentPatientIds, setRecentPatientIds] = useState<string[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>()
  const [diagnosticSummary, setDiagnosticSummary] = useState<DiagnosticSummary | null>(null)
  const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState(false)

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

  // Fetch diagnostic summary when patient is selected
  useEffect(() => {
    if (!selectedPatientId) {
      setDiagnosticSummary(null)
      return
    }

    const fetchDiagnosticSummary = async () => {
      setIsLoadingDiagnostics(true)
      try {
        const response = await fetch(`/api/patients/${selectedPatientId}/diagnostic-summary`)
        if (response.ok) {
          const { data } = await response.json()
          setDiagnosticSummary(data)
        }
      } catch (error) {
        console.error('Failed to fetch diagnostic summary:', error)
      } finally {
        setIsLoadingDiagnostics(false)
      }
    }

    fetchDiagnosticSummary()
  }, [selectedPatientId])

  // Selected patient
  const selectedPatient = useMemo(() => {
    if (!selectedPatientId) return null
    return patients.find(p => p.id === selectedPatientId) || null
  }, [selectedPatientId, patients])

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
    setSelectedPatientId(patient.id)
    addToRecent(patient.id)
    setSearchQuery('')
    setIsFocused(false)
  }, [addToRecent])

  const handleClear = useCallback(() => {
    setSelectedPatientId(undefined)
    setDiagnosticSummary(null)
    setSearchQuery('')
  }, [])

  const handleGenerateProtocol = () => {
    if (selectedPatientId) {
      router.push(`/diagnostics?patient=${selectedPatientId}`)
    }
  }

  const handleViewPatient = () => {
    if (selectedPatientId) {
      router.push(`/patients/${selectedPatientId}`)
    }
  }

  // Show dropdown when focused and either searching or has recent patients
  const showDropdown = isFocused && !selectedPatient && (filteredPatients.length > 0 || (recentPatients.length > 0 && !searchQuery))

  if (isLoading) {
    return (
      <div className={cn('bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-48" />
          <div className="h-12 bg-neutral-100 dark:bg-neutral-700 rounded-xl" />
        </div>
      </div>
    )
  }

  if (patients.length === 0) {
    return (
      <div className={cn('bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6', className)}>
        <div className="text-center py-4">
          <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <HugeiconsIcon icon={UserIcon} size={24} className="text-neutral-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 mb-2">No Patients Yet</h3>
          <p className="text-neutral-500 dark:text-neutral-400 mb-4">Add your first patient to start generating protocols.</p>
          <Link href="/patients/new">
            <Button>
              <HugeiconsIcon icon={Add01Icon} size={18} className="mr-2" />
              Add Patient
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl', className)}>
      {/* Header */}
      <div className="p-6 border-b border-neutral-100 dark:border-neutral-700">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 mb-1">Generate Protocol</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Select a patient to view their diagnostics and generate a protocol</p>
      </div>

      {/* Patient Selection */}
      <div className="p-6">
        {selectedPatient ? (
          <div className="space-y-6">
            {/* Selected Patient Card */}
            <div className="bg-neutral-50 dark:bg-neutral-900 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <HugeiconsIcon icon={UserIcon} size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-50">
                      {selectedPatient.firstName} {selectedPatient.lastName}
                    </p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      {calculateAge(new Date(selectedPatient.dateOfBirth))} years old • {selectedPatient.gender}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={20} />
                </button>
              </div>
            </div>

            {/* Diagnostic Status */}
            {isLoadingDiagnostics ? (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Diagnostic Status</h3>
                <div className="animate-pulse grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="h-10 bg-neutral-100 dark:bg-neutral-700 rounded-lg" />
                  ))}
                </div>
              </div>
            ) : diagnosticSummary ? (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Diagnostic Status</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CORE_DIAGNOSTICS.map(type => {
                    const hasType = diagnosticSummary.diagnosticTypes.includes(type)
                    const info = DIAGNOSTIC_LABELS[type]
                    return (
                      <div
                        key={type}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                          hasType
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                            : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500'
                        )}
                      >
                        <HugeiconsIcon
                          icon={hasType ? Tick02Icon : AlertCircleIcon}
                          size={16}
                          className={hasType ? 'text-green-500' : 'text-neutral-300 dark:text-neutral-600'}
                        />
                        <span className={hasType ? 'font-medium' : ''}>{info.shortLabel}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Summary Stats */}
                <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400 pt-2">
                  <span>
                    {diagnosticSummary.totalUploads} upload{diagnosticSummary.totalUploads !== 1 ? 's' : ''} total
                  </span>
                  {diagnosticSummary.pendingUploads > 0 && (
                    <span className="text-yellow-600 dark:text-yellow-400">
                      {diagnosticSummary.pendingUploads} pending analysis
                    </span>
                  )}
                  {diagnosticSummary.hasAnalysis && (
                    <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                      <HugeiconsIcon icon={Tick02Icon} size={14} />
                      Has analysis
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <HugeiconsIcon icon={AlertCircleIcon} size={20} className="text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800 dark:text-yellow-200">No Diagnostics Uploaded</p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      Upload diagnostic files (HRV, UA, Blood Panel, etc.) to generate AI-powered protocol recommendations.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button onClick={handleGenerateProtocol} className="flex-1 flex items-center justify-center gap-2">
                <HugeiconsIcon icon={AiMagicIcon} size={18} />
                {diagnosticSummary && diagnosticSummary.totalUploads > 0 ? 'Add More Diagnostics' : 'Upload Diagnostics'}
              </Button>
              <Button variant="secondary" onClick={handleViewPatient} className="flex items-center gap-2">
                View Patient
                <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
              </Button>
            </div>
          </div>
        ) : (
          /* Search View */
          <div className="relative">
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
                placeholder="Search for a patient..."
                className={cn(
                  'w-full pl-12 pr-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-600',
                  'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
                  'transition-all'
                )}
              />
            </div>

            {/* Dropdown */}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-lg z-50 max-h-80 overflow-y-auto">
                {/* Search results */}
                {searchQuery && filteredPatients.length > 0 && (
                  <div className="p-2">
                    {filteredPatients.map(patient => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => handleSelect(patient)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <HugeiconsIcon icon={UserIcon} size={16} className="text-blue-500 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-neutral-900 dark:text-neutral-50 truncate">
                            {patient.firstName} {patient.lastName}
                          </p>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            {calculateAge(new Date(patient.dateOfBirth))} years old • {patient.gender}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* No results */}
                {searchQuery && filteredPatients.length === 0 && (
                  <div className="p-4 text-center text-neutral-500 dark:text-neutral-400 text-sm">
                    No patients found matching &quot;{searchQuery}&quot;
                  </div>
                )}

                {/* Recent patients */}
                {!searchQuery && recentPatients.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                      <HugeiconsIcon icon={Clock01Icon} size={14} />
                      Recent Patients
                    </div>
                    {recentPatients.map(patient => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => handleSelect(patient)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center flex-shrink-0">
                          <HugeiconsIcon icon={UserIcon} size={16} className="text-neutral-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-neutral-900 dark:text-neutral-50 truncate">
                            {patient.firstName} {patient.lastName}
                          </p>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            {calculateAge(new Date(patient.dateOfBirth))} years old • {patient.gender}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Empty state - no recent and no search */}
                {!searchQuery && recentPatients.length === 0 && (
                  <div className="p-4 text-center text-neutral-500 dark:text-neutral-400 text-sm">
                    Start typing to search for patients
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
