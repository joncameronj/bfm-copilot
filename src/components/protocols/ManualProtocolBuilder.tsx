'use client'

import { useState } from 'react'
import { FrequencyBrowser } from './FrequencyBrowser'
import { ProtocolCart } from './ProtocolCart'
import { useManualProtocol } from '@/hooks/useManualProtocol'
import { useRouter } from 'next/navigation'
import type { ApprovedFrequency } from '@/types/frequency'

/**
 * Main Manual Protocol Builder component
 * Orchestrates frequency browser and protocol cart
 */
export function ManualProtocolBuilder() {
  const router = useRouter()
  const [selectedPatientId, setSelectedPatientId] = useState<string>()
  const [selectedPatientName, setSelectedPatientName] = useState<string>()
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const { selectedFrequencies, toggleFrequency, clearSelection, createSession, isLoading, error } =
    useManualProtocol()

  const handleCreateSession = async (input: {
    patientId: string
    sessionDate: string
    sessionTime?: string
    notes?: string
  }) => {
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const session = await createSession(input)
      setSuccessMessage('Treatment session created successfully!')

      // Clear selection
      clearSelection()
      setSelectedPatientId(undefined)
      setSelectedPatientName(undefined)

      // Redirect to patient detail page after 2 seconds
      setTimeout(() => {
        router.push(`/patients/${input.patientId}`)
      }, 2000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create treatment session'
      setErrorMessage(message)
    }
  }

  return (
    <div className="space-y-8">
      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4 text-green-700 dark:text-green-400">
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-red-700 dark:text-red-400">
          {errorMessage}
        </div>
      )}

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Frequency Browser (2/3) */}
        <div className="lg:col-span-2">
          <FrequencyBrowser
            selectedFrequencies={selectedFrequencies}
            onFrequencyToggle={toggleFrequency}
          />
        </div>

        {/* Right: Protocol Cart (1/3) */}
        <div className="lg:col-span-1">
          <ProtocolCart
            selectedFrequencies={selectedFrequencies}
            onFrequencyRemove={(frequencyId) => {
              const freq = selectedFrequencies.find((f) => f.id === frequencyId)
              if (freq) toggleFrequency(freq)
            }}
            onClear={clearSelection}
            selectedPatientId={selectedPatientId}
            selectedPatientName={selectedPatientName}
            onPatientSelect={(id, name) => {
              setSelectedPatientId(id)
              setSelectedPatientName(name)
            }}
            onSubmit={handleCreateSession}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Mobile Responsive: Show cart below on small screens */}
      {/* This is handled by the grid layout - it stacks on mobile */}
    </div>
  )
}
