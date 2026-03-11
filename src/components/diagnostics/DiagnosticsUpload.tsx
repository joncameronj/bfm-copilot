'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { HugeiconsIcon } from '@hugeicons/react'
import { AiMagicIcon, Loading03Icon, Tick01Icon } from '@hugeicons/core-free-icons'
import { FilePreview } from './FilePreview'
import { Button } from '@/components/ui/Button'
import type { DiagnosticType } from '@/types/shared'

interface UploadFile {
  id: string
  file: File
  type: DiagnosticType
  progress: number
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'error'
  url?: string
  error?: string
}

interface DiagnosticsUploadProps {
  patientId?: string
  uploadId?: string
  onComplete?: (files: UploadFile[], uploadId?: string, statusUpdated?: boolean) => void
  onAnalysisGenerated?: (analysisId: string) => void
  showGenerateButton?: boolean
  abortRef?: { current: AbortController | null }
}

export function DiagnosticsUpload({
  patientId,
  uploadId: initialUploadId,
  onComplete,
  onAnalysisGenerated,
  showGenerateButton = true,
  abortRef,
}: DiagnosticsUploadProps) {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadId, setUploadId] = useState<string | undefined>(initialUploadId)
  const [isGenerating, setIsGenerating] = useState(false)
  const [analysisGenerated, setAnalysisGenerated] = useState(false)
  const [analysisAbortController, setAnalysisAbortController] = useState<AbortController | null>(null)

  const guessFileType = useCallback((filename: string): DiagnosticType => {
    const lower = filename.toLowerCase()
    if (lower.includes('pulse') || lower.includes('dpulse') || lower.includes('depulse')) return 'd_pulse'
    if (lower.includes('hrv')) return 'hrv'
    if (lower.includes('ortho')) return 'ortho'
    if (lower.includes('valsalva')) return 'valsalva'
    if (lower.includes('ua') || lower.includes('urinalysis') || lower.includes('urine')) return 'urinalysis'
    if (lower.includes('vcs') || lower.includes('visual contrast')) return 'vcs'
    if (lower.includes('brainwave') || lower.includes('eeg') || lower.includes('brain')) return 'brainwave'
    if (lower.includes('nes') || lower.includes('nes scan')) return 'nes_scan'
    if (lower.includes('mold') || lower.includes('mycotox')) return 'mold_toxicity'
    if (lower.includes('blood') || lower.includes('lab') || lower.includes('cbc')) return 'blood_panel'
    return 'other'
  }, [])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Max 6 files
    const availableSlots = 6 - files.length
    const newFiles = acceptedFiles.slice(0, availableSlots).map((file) => ({
      id: crypto.randomUUID(),
      file,
      type: guessFileType(file.name),
      progress: 0,
      status: 'pending' as const,
    }))

    setFiles((prev) => [...prev, ...newFiles])
  }, [files.length, guessFileType])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.heic'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 6,
    disabled: files.length >= 6 || isUploading,
  })

  const updateFileType = (id: string, type: DiagnosticType) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, type } : f))
    )
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const uploadFiles = async () => {
    setIsUploading(true)

    const updatedFiles = [...files]
    let currentUploadId = uploadId

    for (let i = 0; i < updatedFiles.length; i++) {
      const fileData = updatedFiles[i]
      if (fileData.status !== 'pending') continue

      // Update status to uploading
      updatedFiles[i] = { ...fileData, status: 'uploading' }
      setFiles([...updatedFiles])

      try {
        const formData = new FormData()
        formData.append('file', fileData.file)
        formData.append('type', fileData.type)
        if (patientId) formData.append('patientId', patientId)
        if (currentUploadId) formData.append('uploadId', currentUploadId)

        const response = await fetch('/api/diagnostics/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error('Upload failed')
        }

        const result = await response.json()

        // Track the upload ID from the first successful upload
        if (result.data?.uploadId && !currentUploadId) {
          currentUploadId = result.data.uploadId
          setUploadId(result.data.uploadId)
        }

        // Update status to complete
        updatedFiles[i] = {
          ...fileData,
          status: 'complete',
          url: result.data?.url,
          progress: 100,
        }
        setFiles([...updatedFiles])
      } catch (error) {
        updatedFiles[i] = {
          ...fileData,
          status: 'error',
          error: error instanceof Error ? error.message : 'Upload failed',
        }
        setFiles([...updatedFiles])
      }
    }

    // Check if all files uploaded successfully
    const allUploaded = updatedFiles.every((f) => f.status === 'complete')

    // Mark the upload batch as 'uploaded' (ready for analysis) with retry logic
    let statusUpdateSuccess = false
    if (allUploaded && currentUploadId) {
      const updateStatus = async (retries = 3): Promise<boolean> => {
        for (let i = 0; i < retries; i++) {
          try {
            const response = await fetch(`/api/diagnostics/${currentUploadId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'uploaded' }),
            })
            if (response.ok) return true
          } catch (error) {
            console.error(`Failed to update upload status (attempt ${i + 1}):`, error)
          }
          // Wait before retry (exponential backoff)
          if (i < retries - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)))
          }
        }
        return false
      }
      statusUpdateSuccess = await updateStatus()
    }

    setIsUploading(false)
    // Pass success status to callback so it can handle toast appropriately
    onComplete?.(updatedFiles, currentUploadId, statusUpdateSuccess)
  }

  const generateAnalysis = async () => {
    if (!uploadId || !patientId) return

    const controller = new AbortController()
    setAnalysisAbortController(controller)
    if (abortRef) {
      abortRef.current = controller
    }
    setIsGenerating(true)
    try {
      const response = await fetch(`/api/diagnostics/${uploadId}/generate-analysis`, {
        method: 'POST',
        signal: controller.signal,
      })

      if (!response.ok) {
        let message = 'Failed to generate analysis'
        try {
          const errorPayload = await response.json()
          message = errorPayload?.error || message
        } catch {
          // Ignore parse failures and keep fallback message.
        }
        throw new Error(message)
      }

      const result = await response.json()
      setAnalysisGenerated(true)
      onAnalysisGenerated?.(result.data.analysisId)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      console.error('Analysis generation failed:', error)
    } finally {
      setIsGenerating(false)
      setAnalysisAbortController(null)
    }
  }

  const cancelAnalysis = () => {
    analysisAbortController?.abort()
  }

  const pendingCount = files.filter((f) => f.status === 'pending').length
  const hasErrors = files.some((f) => f.status === 'error')
  const allComplete = files.length > 0 && files.every((f) => f.status === 'complete')

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`
          bg-neutral-50 rounded-2xl p-12 text-center cursor-pointer transition-colors
          ${isDragActive ? 'bg-neutral-100 ring-2 ring-brand-blue ring-offset-2' : 'hover:bg-neutral-100'}
          ${files.length >= 6 || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="max-w-md mx-auto">
          <svg
            className="w-12 h-12 mx-auto text-neutral-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-neutral-600 text-lg">
            {isDragActive
              ? 'Drop files here...'
              : files.length >= 6
              ? 'Maximum 6 files reached'
              : 'Drag & drop up to 6 files, or click to select'}
          </p>
          <p className="text-neutral-400 text-sm mt-2">
            Supports: D-Pulse, HRV, Ortho, Valsalva, Urinalysis (UA), VCS, Brainwave, NES Scan, Mold Toxicity, Blood Panels
          </p>
          <p className="text-neutral-400 text-xs mt-1">
            PDF, Images, Word documents
          </p>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          {files.map((file) => (
            <FilePreview
              key={file.id}
              file={file}
              onTypeChange={(type) => updateFileType(file.id, type)}
              onRemove={() => removeFile(file.id)}
              disabled={isUploading}
            />
          ))}
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && pendingCount > 0 && (
        <Button
          onClick={uploadFiles}
          isLoading={isUploading}
          className="w-full"
        >
          Upload {pendingCount} file{pendingCount > 1 ? 's' : ''}
        </Button>
      )}

      {/* Error Message */}
      {hasErrors && (
        <p className="text-sm text-red-600 text-center">
          Some files failed to upload. Please try again.
        </p>
      )}

      {/* Generate Analysis Button */}
      {showGenerateButton && uploadId && patientId && allComplete && !analysisGenerated && (
        <div className="flex gap-3">
          <Button
            onClick={generateAnalysis}
            isLoading={isGenerating}
            className="flex-1 flex items-center justify-center gap-2"
          >
            <HugeiconsIcon icon={AiMagicIcon} size={20} />
            {isGenerating ? 'Generating...' : 'Generate AI Analysis'}
          </Button>
          {isGenerating && (
            <Button
              variant="secondary"
              onClick={cancelAnalysis}
            >
              Cancel
            </Button>
          )}
        </div>
      )}

      {/* Analysis Generated Success */}
      {analysisGenerated && (
        <div className="bg-green-50 rounded-xl p-4 flex items-center gap-3">
          <HugeiconsIcon icon={Tick01Icon} size={20} className="text-green-600" />
          <div>
            <p className="font-medium text-green-900">Analysis Generated</p>
            <p className="text-sm text-green-700">
              View the analysis on the patient&apos;s profile page.
            </p>
          </div>
        </div>
      )}

      {/* Patient Required Notice */}
      {!patientId && files.length > 0 && (
        <div className="bg-yellow-50 rounded-xl p-4">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Select a patient to link these diagnostics and enable AI analysis generation.
          </p>
        </div>
      )}
    </div>
  )
}
