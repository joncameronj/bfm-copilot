'use client'

import { useState, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { PdfUpload } from '@/components/labs/PdfUpload'
import { calculateLabResults } from '@/lib/labs/calculator'
import type { PatientContext, LabFormValues } from '@/types/labs'
import { HugeiconsIcon } from '@hugeicons/react'
import { FloppyDiskIcon, Cancel01Icon } from '@hugeicons/core-free-icons'
import toast from 'react-hot-toast'

interface PatientLabUploadModalProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName: string
  patientAge: number
  patientGender: 'male' | 'female'
  onSuccess?: () => void
}

export function PatientLabUploadModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  patientAge,
  patientGender,
  onSuccess,
}: PatientLabUploadModalProps) {
  const [extractedValues, setExtractedValues] = useState<LabFormValues>({})
  const [extractionConfidence, setExtractionConfidence] = useState<number | undefined>()
  const [hasValues, setHasValues] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Patient context for lab calculations
  const patientContext: PatientContext = {
    gender: patientGender === 'other' ? 'male' : patientGender,
    age: patientAge,
  }

  const handleValuesExtracted = useCallback((values: Record<string, number>, confidence?: number) => {
    setExtractedValues(values)
    setExtractionConfidence(confidence)
    setHasValues(Object.keys(values).length > 0)
  }, [])

  const handleSave = useCallback(async () => {
    if (!hasValues) return

    setIsSaving(true)
    try {
      // Calculate results
      const results = calculateLabResults(extractedValues, patientContext)

      // Save to API
      const response = await fetch('/api/labs/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          result: results,
          values: extractedValues,
          testDate: new Date().toISOString().split('T')[0],
          isComplete: true,
          missingMarkers: [],
          sourceType: 'pdf_upload',
          extractionConfidence,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save lab results')
      }

      toast.success('Lab results saved successfully')
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save lab results')
    } finally {
      setIsSaving(false)
    }
  }, [hasValues, extractedValues, patientContext, patientId, extractionConfidence, onSuccess, onClose])

  const handleClose = () => {
    setExtractedValues({})
    setExtractionConfidence(undefined)
    setHasValues(false)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Upload Labs for ${patientName}`} size="2xl">
      <div className="space-y-6">
        {/* Patient Info */}
        <div className="flex items-center gap-2 text-sm text-neutral-500 bg-neutral-50 rounded-lg px-4 py-3">
          <span>Patient: <strong className="text-neutral-900">{patientName}</strong></span>
          <span className="text-neutral-300">•</span>
          <span>{patientAge} years</span>
          <span className="text-neutral-300">•</span>
          <span className="capitalize">{patientGender}</span>
        </div>

        {/* PDF Upload */}
        <PdfUpload
          onValuesExtracted={handleValuesExtracted}
          className="w-full"
        />

        {/* Extracted Values Count */}
        {hasValues && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <p className="text-green-700 font-medium">
              {Object.keys(extractedValues).length} lab values extracted
            </p>
            <p className="text-green-600 text-sm mt-1">
              Click &quot;Save Lab Results&quot; to save these values to the patient&apos;s record.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" onClick={handleClose} disabled={isSaving}>
            <HugeiconsIcon icon={Cancel01Icon} size={16} className="mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasValues || isSaving}
            isLoading={isSaving}
          >
            <HugeiconsIcon icon={FloppyDiskIcon} size={16} className="mr-2" />
            Save Lab Results
          </Button>
        </div>
      </div>
    </Modal>
  )
}
