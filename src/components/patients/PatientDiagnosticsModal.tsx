'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [, setUploadComplete] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const handleUploadComplete = useCallback(() => {
    setUploadComplete(true)
  }, [])

  const handleAnalysisGenerated = useCallback(() => {
    setStatus('complete')
    toast((t) => (
      <div className="flex items-center gap-3">
        <span>Analysis complete for <strong>{patientName}</strong></span>
        <button
          className="text-sm font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
          onClick={() => {
            toast.dismiss(t.id)
            router.push(`/patients/${patientId}`)
          }}
        >
          View Analysis
        </button>
      </div>
    ), { duration: 10000, icon: '\u2705' })

    // Auto-close after a short delay to show the success state
    setTimeout(() => {
      onSuccess?.()
      handleClose()
    }, 1500)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSuccess, patientName, patientId, router])

  const handleClose = () => {
    setStatus('idle')
    setUploadComplete(false)
    onClose()
  }

  // Track when generating starts
  const handleGenerateStart = useCallback(() => {
    setStatus('analyzing')
  }, [])

  const handleCancelAnalysis = () => {
    abortRef.current?.abort()
    setStatus('idle')
    setShowCancelConfirm(false)
  }

  const isAnalyzing = status === 'analyzing' || status === 'generating'

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Upload Diagnostics for ${patientName}`} size="3xl">
      <div className="space-y-6">
        {/* Patient Info */}
        <div className="flex items-center gap-2 text-sm text-neutral-500 bg-neutral-50 rounded-lg px-4 py-3">
          <span>Patient: <strong className="text-neutral-900">{patientName}</strong></span>
        </div>

        {/* Status Indicator — shown during analysis/generating */}
        <AnalysisStatusIndicator status={status} />

        {/* Diagnostics Upload — visually hidden once analysis starts (keep mounted for API call) */}
        {status !== 'complete' && (
          <div className={isAnalyzing ? 'hidden' : undefined}>
            <DiagnosticsUploadWithStatus
              patientId={patientId}
              onComplete={handleUploadComplete}
              onAnalysisGenerated={handleAnalysisGenerated}
              onGenerateStart={handleGenerateStart}
              abortRef={abortRef}
            />
          </div>
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
          {isAnalyzing && !showCancelConfirm && (
            <Button variant="danger" onClick={() => setShowCancelConfirm(true)}>
              <HugeiconsIcon icon={Cancel01Icon} size={16} className="mr-2" />
              Cancel Analysis
            </Button>
          )}
          {isAnalyzing && showCancelConfirm && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">Cancel analysis?</span>
              <Button variant="danger" onClick={handleCancelAnalysis}>
                Yes, Cancel
              </Button>
              <Button variant="secondary" onClick={() => setShowCancelConfirm(false)}>
                No, Continue
              </Button>
            </div>
          )}
          {!isAnalyzing && (
            <Button variant="secondary" onClick={handleClose}>
              <HugeiconsIcon icon={Cancel01Icon} size={16} className="mr-2" />
              {status === 'complete' ? 'Close' : 'Cancel'}
            </Button>
          )}
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
  abortRef?: { current: AbortController | null }
}

function DiagnosticsUploadWithStatus({
  patientId,
  onComplete,
  onAnalysisGenerated,
  onGenerateStart,
  abortRef,
}: DiagnosticsUploadWithStatusProps) {
  const handleAnalysisGenerated = useCallback((analysisId: string) => {
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
        abortRef={abortRef}
      />
    </div>
  )
}
