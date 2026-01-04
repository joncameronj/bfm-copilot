'use client'

import { useEffect, useState } from 'react'
import { DiagnosticsUpload } from '@/components/diagnostics/DiagnosticsUpload'
import { DiagnosticsTable } from '@/components/diagnostics/DiagnosticsTable'
import { LoadingSpinner } from '@/components/ui/Spinner'
import { PatientSearchSelector } from '@/components/shared/PatientSearchSelector'
import { toast } from 'react-hot-toast'

interface DiagnosticFile {
  id: string
  filename: string
  fileType: string
  mimeType: string
  sizeBytes: number
  status: string
}

interface DiagnosticUpload {
  id: string
  status: string
  analysisSummary?: string
  createdAt: string
  updatedAt: string
  files: DiagnosticFile[]
}

export default function DiagnosticsPage() {
  const [uploads, setUploads] = useState<DiagnosticUpload[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(undefined)

  const fetchUploads = async () => {
    try {
      const response = await fetch('/api/diagnostics')
      if (response.ok) {
        const { data } = await response.json()
        setUploads(data || [])
      }
    } catch (error) {
      console.error('Failed to fetch diagnostics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUploads()
  }, [])

  const handleUploadComplete = () => {
    toast.success('Files uploaded successfully')
    fetchUploads()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-[-0.05em] text-neutral-900 dark:text-neutral-50">Diagnostics</h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">
          Upload and analyze diagnostic files
        </p>
      </div>

      {/* Patient Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Select Patient
        </label>
        <PatientSearchSelector
          value={selectedPatientId}
          onChange={setSelectedPatientId}
          placeholder="Search patients..."
        />
        {!selectedPatientId && (
          <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-2">
            Select a patient to enable AI analysis generation
          </p>
        )}
      </div>

      {/* Upload Section */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-50 mb-4">
          Upload Files
        </h2>
        <DiagnosticsUpload
          patientId={selectedPatientId}
          onComplete={handleUploadComplete}
        />
      </div>

      {/* Previous Uploads */}
      <div>
        <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-50 mb-4">
          Previous Uploads
        </h2>

        <DiagnosticsTable
          files={uploads.flatMap((upload) =>
            upload.files.map((file) => ({
              ...file,
              uploadId: upload.id,
              uploadedAt: upload.createdAt,
              uploadStatus: upload.status,
            }))
          )}
          isLoading={isLoading}
          onRefresh={fetchUploads}
        />
      </div>
    </div>
  )
}
