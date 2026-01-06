'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { ApprovedFrequency } from '@/types/frequency'

interface ProtocolCartProps {
  selectedFrequencies: ApprovedFrequency[]
  onFrequencyRemove: (frequencyId: string) => void
  onClear: () => void
  selectedPatientId?: string
  selectedPatientName?: string
  onPatientSelect: (patientId: string, patientName: string) => void
  patients: Array<{ id: string; firstName: string; lastName: string }>
  onSubmit: (input: {
    patientId: string
    sessionDate: string
    sessionTime?: string
    notes?: string
  }) => Promise<void>
  isLoading?: boolean
}

/**
 * Shopping cart for selected frequencies with patient selector and submission
 */
export function ProtocolCart({
  selectedFrequencies,
  onFrequencyRemove,
  onClear,
  selectedPatientId,
  selectedPatientName,
  onPatientSelect,
  patients,
  onSubmit,
  isLoading = false,
}: ProtocolCartProps) {
  const [patientSearch, setPatientSearch] = useState('')
  const [showPatientResults, setShowPatientResults] = useState(false)
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0])
  const [sessionTime, setSessionTime] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Filter patients based on search term
  const filteredPatients = patientSearch.trim()
    ? patients.filter((p) =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(patientSearch.toLowerCase())
      )
    : patients

  const handleSubmit = useCallback(async () => {
    if (!selectedPatientId || selectedFrequencies.length === 0) {
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({
        patientId: selectedPatientId,
        sessionDate,
        sessionTime: sessionTime || undefined,
        notes: notes || undefined,
      })
      // Clear form after successful submission
      setSessionDate(new Date().toISOString().split('T')[0])
      setSessionTime('')
      setNotes('')
    } finally {
      setSubmitting(false)
    }
  }, [selectedPatientId, selectedFrequencies, sessionDate, sessionTime, notes, onSubmit])

  const canSubmit = selectedPatientId && selectedFrequencies.length > 0 && !submitting && !isLoading

  return (
    <div className="sticky top-6 rounded-2xl border-2 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          Protocol Cart
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          {selectedFrequencies.length} frequenc{selectedFrequencies.length === 1 ? 'y' : 'ies'} selected
        </p>
      </div>

      {/* Selected Frequencies List */}
      {selectedFrequencies.length > 0 ? (
        <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-4 space-y-2 max-h-48 overflow-y-auto">
          {selectedFrequencies.map((freq) => (
            <div key={freq.id} className="flex items-center justify-between text-sm group">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                  {freq.name}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 capitalize">
                  {freq.category}
                </p>
              </div>
              <button
                onClick={() => onFrequencyRemove(freq.id)}
                className="ml-2 text-neutral-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove frequency"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-neutral-500 dark:text-neutral-400">
            Select frequencies to build protocol
          </p>
        </div>
      )}

      {/* Clear Selection */}
      {selectedFrequencies.length > 0 && (
        <button
          onClick={onClear}
          className="w-full text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium"
        >
          Clear All
        </button>
      )}

      <div className="border-t border-neutral-200 dark:border-neutral-800" />

      {/* Patient Selector */}
      <div>
        <label className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          Patient
        </label>
        <div className="relative">
          <Input
            type="text"
            placeholder="Search for patient..."
            value={selectedPatientName || patientSearch}
            onChange={(e) => {
              const value = e.target.value
              if (!selectedPatientId || value !== selectedPatientName) {
                setPatientSearch(value)
                setShowPatientResults(true)
              }
            }}
            onFocus={() => {
              if (patientSearch || !selectedPatientId) {
                setShowPatientResults(true)
              }
            }}
            onBlur={() => {
              setTimeout(() => setShowPatientResults(false), 200)
            }}
            disabled={isLoading || submitting}
            className="w-full"
          />

          {/* Patient Results */}
          {showPatientResults && (patientSearch || !selectedPatientId) && (
            <div className="absolute top-full mt-2 w-full bg-white dark:bg-neutral-950 border-2 border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
              {filteredPatients.length === 0 ? (
                <div className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">
                  {patients.length === 0 ? 'No patients found' : 'No matching patients'}
                </div>
              ) : (
                filteredPatients.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => {
                      onPatientSelect(patient.id, `${patient.firstName} ${patient.lastName}`)
                      setPatientSearch('')
                      setShowPatientResults(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-900 dark:text-neutral-100"
                  >
                    {patient.firstName} {patient.lastName}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Session Date */}
      <div>
        <label className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          Session Date
        </label>
        <Input
          type="date"
          value={sessionDate}
          onChange={(e) => setSessionDate(e.target.value)}
          disabled={isLoading || submitting}
          className="w-full"
        />
      </div>

      {/* Session Time (Optional) */}
      <div>
        <label className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          Session Time <span className="text-xs text-neutral-500 dark:text-neutral-400">(optional)</span>
        </label>
        <Input
          type="time"
          value={sessionTime}
          onChange={(e) => setSessionTime(e.target.value)}
          disabled={isLoading || submitting}
          className="w-full"
        />
      </div>

      {/* Notes (Optional) */}
      <div>
        <label className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          Notes <span className="text-xs text-neutral-500 dark:text-neutral-400">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes about this session..."
          disabled={isLoading || submitting}
          className="w-full px-4 py-2 rounded-lg border-2 border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors resize-none"
          rows={3}
        />
      </div>

      {/* Submit Button */}
      <Button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full"
      >
        {submitting ? 'Creating Session...' : 'Create Session'}
      </Button>

      {/* Help Text */}
      {!canSubmit && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
          {selectedFrequencies.length === 0
            ? 'Select frequencies to continue'
            : 'Select a patient to continue'}
        </p>
      )}
    </div>
  )
}
