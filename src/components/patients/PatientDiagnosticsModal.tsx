'use client'

import { useState, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { DiagnosticsUpload } from '@/components/diagnostics/DiagnosticsUpload'
import { AnalysisStatusIndicator, type AnalysisStatus } from './AnalysisStatusIndicator'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import toast from 'react-hot-toast'

interface PatientDiagnosticsModalProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName: string
  onSuccess?: () => void
}

export function PatientDiagnosticsModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  onSuccess,
}: PatientDiagnosticsModalProps) {
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [, setUploadComplete] = useState(false)

  const handleUploadComplete = useCallback(() => {
    setUploadComplete(true)
  }, [])

  const handleAnalysisGenerated = useCallback(() => {
    setStatus('complete')
    toast.success('Analysis complete!')

    // Auto-close after a short delay to show the success state
    setTimeout(() => {
      onSuccess?.()
      handleClose()
    }, 1500)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSuccess])

  const handleClose = () => {
    setStatus('idle')
    setUploadComplete(false)
    onClose()
  }

  // Track when generating starts
  const handleGenerateStart = useCallback(() => {
    setStatus('analyzing')
  }, [])

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Upload Diagnostics for ${patientName}`} size="3xl">
      <div className="space-y-6">
        {/* Patient Info */}
        <div className="flex items-center gap-2 text-sm text-neutral-500 bg-neutral-50 rounded-lg px-4 py-3">
          <span>Patient: <strong className="text-neutral-900">{patientName}</strong></span>
        </div>

        {/* Status Indicator */}
        <AnalysisStatusIndicator status={status} />

        {/* Diagnostics Upload */}
        {status !== 'complete' && (
          <DiagnosticsUploadWithStatus
            patientId={patientId}
            onComplete={handleUploadComplete}
            onAnalysisGenerated={handleAnalysisGenerated}
            onGenerateStart={handleGenerateStart}
          />
        )}

        {/* Success Message */}
        {status === 'complete' && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-6 text-center">
            <p className="text-green-700 font-medium text-lg">
              Analysis Complete!
            </p>
            <p className="text-green-600 text-sm mt-2">
              The diagnostic analysis and protocol recommendations have been generated.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" onClick={handleClose}>
            <HugeiconsIcon icon={Cancel01Icon} size={16} className="mr-2" />
            {status === 'complete' ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// Wrapper component to add onGenerateStart callback
interface DiagnosticsUploadWithStatusProps {
  patientId: string
  onComplete?: () => void
  onAnalysisGenerated?: (analysisId: string) => void
  onGenerateStart?: () => void
}

function DiagnosticsUploadWithStatus({
  patientId,
  onComplete,
  onAnalysisGenerated,
  onGenerateStart,
}: DiagnosticsUploadWithStatusProps) {
  const [isGenerating, setIsGenerating] = useState(false)

  const handleAnalysisGenerated = useCallback((analysisId: string) => {
    setIsGenerating(false)
    onAnalysisGenerated?.(analysisId)
  }, [onAnalysisGenerated])

  // Custom wrapper to detect when generation starts
  // We'll monitor for the button click by wrapping the component
  return (
    <div
      onClick={(e) => {
        // Check if the clicked element is the generate button
        const target = e.target as HTMLElement
        if (target.closest('button')?.textContent?.includes('Generate')) {
          onGenerateStart?.()
        }
      }}
    >
      <DiagnosticsUpload
        patientId={patientId}
        onComplete={onComplete}
        onAnalysisGenerated={handleAnalysisGenerated}
        showGenerateButton={true}
      />
    </div>
  )
}
