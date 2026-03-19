'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { HugeiconsIcon } from '@hugeicons/react'
import { Tick01Icon, ArrowRight01Icon, AiMagicIcon } from '@hugeicons/core-free-icons'
import { DiagnosticsUpload } from '@/components/diagnostics/DiagnosticsUpload'
import { AnalysisProgress } from '@/components/diagnostics/AnalysisProgress'
import { PatientSearchSelector } from '@/components/shared/PatientSearchSelector'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

interface DiagnosticFile {
  id: string
  filename: string
  fileType: string
}

interface DiagnosticUploadData {
  id: string
  status: string
  patientId: string | null
  createdAt: string
  files: DiagnosticFile[]
}

export default function DiagnosticsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const urlPatientId = searchParams.get('patient')

  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(urlPatientId || undefined)
  const [selectedPatientName, setSelectedPatientName] = useState<string | null>(null)
  const [patientUploads, setPatientUploads] = useState<DiagnosticUploadData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedAnalysisId, setGeneratedAnalysisId] = useState<string | null>(null)
  const [analysisComplete, setAnalysisComplete] = useState(false)
  const [uploadKey, setUploadKey] = useState(0) // To reset upload component
  const [abortController, setAbortController] = useState<AbortController | null>(null)

  // Fetch uploads for selected patient
  const fetchPatientUploads = useCallback(async () => {
    if (!selectedPatientId) {
      setPatientUploads([])
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/diagnostics?patientId=${selectedPatientId}`)
      if (response.ok) {
        const { data } = await response.json()
        setPatientUploads(data || [])
      }
    } catch (error) {
      console.error('Failed to fetch uploads:', error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedPatientId])

  useEffect(() => {
    fetchPatientUploads()
  }, [fetchPatientUploads])

  // Fetch patient name when selected
  useEffect(() => {
    if (!selectedPatientId) {
      setSelectedPatientName(null)
      return
    }
    fetch(`/api/patients/${selectedPatientId}`)
      .then((res) => res.ok ? res.json() : null)
      .then((result) => {
        if (result?.data) {
          setSelectedPatientName(`${result.data.firstName} ${result.data.lastName}`)
        }
      })
      .catch(() => {})
  }, [selectedPatientId])

  // Handle patient change
  const handlePatientChange = (patientId: string | undefined) => {
    setSelectedPatientId(patientId)
    setCurrentUploadId(null)
    setGeneratedAnalysisId(null)
    setUploadKey(prev => prev + 1) // Reset upload component
  }

  // Handle upload complete
  const handleUploadComplete = async (
    _files: unknown,
    uploadId?: string,
    statusUpdated?: boolean
  ) => {
    if (uploadId) {
      setCurrentUploadId(uploadId)
    }

    if (statusUpdated) {
      toast.success('Files uploaded and saved to patient profile!')
    } else {
      toast.success('Files uploaded - click "Generate Analysis" to continue')
    }

    // Refresh uploads list
    await fetchPatientUploads()
  }

  // Generate analysis for the current upload
  const handleGenerateAnalysis = async (uploadId: string) => {
    if (!selectedPatientId) {
      toast.error('Please select a patient first')
      return
    }

    const controller = new AbortController()
    setAbortController(controller)
    setIsGenerating(true)
    setAnalysisComplete(false)
    try {
      const response = await fetch(`/api/diagnostics/${uploadId}/generate-analysis`, {
        method: 'POST',
        signal: controller.signal,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate analysis')
      }

      const result = await response.json()
      setGeneratedAnalysisId(result.data?.analysisId)

      if (result.data?.status === 'processing') {
        // Poll GET endpoint until analysis completes
        const pollInterval = 5000
        const maxPolls = 120 // 10 minutes max
        let polls = 0

        while (polls < maxPolls) {
          await new Promise(resolve => setTimeout(resolve, pollInterval))
          polls++

          if (controller.signal.aborted) return

          const statusRes = await fetch(
            `/api/diagnostics/${uploadId}/generate-analysis`,
            { signal: controller.signal }
          )
          if (!statusRes.ok) continue

          const statusData = await statusRes.json()
          if (statusData.data?.status === 'complete') {
            break
          }
          if (statusData.data?.status === 'error') {
            throw new Error(statusData.data?.errorMessage || 'Analysis failed')
          }
        }
      }

      setAnalysisComplete(true)

      const name = selectedPatientName || 'patient'
      toast((t) => (
        <div className="flex items-center gap-3">
          <span>Analysis complete for <strong>{name}</strong></span>
          <button
            className="text-sm font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
            onClick={() => {
              toast.dismiss(t.id)
              router.push(`/patients/${selectedPatientId}`)
            }}
          >
            View Analysis
          </button>
        </div>
      ), { duration: 10000, icon: '\u2705' })

      // Reset for next upload
      setCurrentUploadId(null)
      setUploadKey(prev => prev + 1)

      // Refresh uploads
      await fetchPatientUploads()

      // Let user see 100% completion, then navigate
      await new Promise(resolve => setTimeout(resolve, 1500))
      router.push(`/patients/${selectedPatientId}`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast('Analysis cancelled', { icon: '🛑' })
        return
      }
      console.error('Analysis generation failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate analysis')
    } finally {
      setIsGenerating(false)
      setAnalysisComplete(false)
      setAbortController(null)
    }
  }

  const handleCancelAnalysis = () => {
    if (abortController) {
      abortController.abort()
    }
  }

  const handleDeleteUpload = async (uploadId: string) => {
    if (!confirm('Delete this upload and any associated analysis?')) return
    try {
      const res = await fetch(`/api/diagnostics/${uploadId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      toast.success('Upload deleted')
      await fetchPatientUploads()
    } catch {
      toast.error('Failed to delete upload')
    }
  }

  // Get pending uploads (uploaded but no analysis yet)
  const pendingUploads = patientUploads.filter(u => u.status === 'uploaded')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-[-0.05em] text-neutral-900 dark:text-neutral-50">
          Diagnostics
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">
          Upload diagnostic files and generate AI-powered protocol recommendations
        </p>
      </div>

      {/* Step 1: Select Patient */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm">
            1
          </div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            Select Patient
          </h2>
        </div>
        <PatientSearchSelector
          value={selectedPatientId}
          onChange={handlePatientChange}
          placeholder="Search and select a patient..."
        />
      </div>

      {/* Step 2: Upload Files (only if patient selected) */}
      {selectedPatientId && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm">
              2
            </div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              Upload Diagnostic Files
            </h2>
          </div>
          <DiagnosticsUpload
            key={uploadKey}
            patientId={selectedPatientId}
            onComplete={handleUploadComplete}
            showGenerateButton={false}
          />
        </div>
      )}

      {/* Step 3: Generate Analysis (if we have a current upload) */}
      {selectedPatientId && currentUploadId && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm">
              3
            </div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              Generate Analysis & Protocols
            </h2>
          </div>
          {isGenerating ? (
            <AnalysisProgress isComplete={analysisComplete} onCancel={handleCancelAnalysis} />
          ) : (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6">
              <p className="text-blue-800 dark:text-blue-200 mb-4">
                Files uploaded successfully! Click below to generate AI analysis and protocol recommendations.
              </p>
              <Button
                onClick={() => handleGenerateAnalysis(currentUploadId)}
              >
                Generate Analysis & Protocols
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Success Message */}
      {generatedAnalysisId && selectedPatientId && (
        <div className="mb-8 bg-green-50 dark:bg-green-900/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <HugeiconsIcon icon={Tick01Icon} size={24} className="text-green-600" />
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
              Analysis Complete!
            </h3>
          </div>
          <p className="text-green-700 dark:text-green-300 mb-4">
            Protocol recommendations have been generated and saved to the patient&apos;s profile.
          </p>
          <Link href={`/patients/${selectedPatientId}`}>
            <Button variant="secondary" className="flex items-center gap-2">
              View Patient Profile
              <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
            </Button>
          </Link>
        </div>
      )}

      {/* Pending Uploads (need analysis) */}
      {selectedPatientId && pendingUploads.length > 0 && !currentUploadId && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
            Pending Uploads (Ready for Analysis)
          </h2>
          <div className="space-y-4">
            {pendingUploads.map((upload) => (
              <div
                key={upload.id}
                className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-neutral-900 dark:text-neutral-50">
                    {upload.files.length} files uploaded
                  </p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {formatDate(upload.createdAt)} •{' '}
                    {upload.files.map(f => f.fileType.replace('_', ' ')).join(', ')}
                  </p>
                </div>
                <Button
                  onClick={() => handleGenerateAnalysis(upload.id)}
                  isLoading={isGenerating}
                  size="sm"
                >
                  Generate Analysis
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Patient Uploads History */}
      {selectedPatientId && patientUploads.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
            Upload History for This Patient
          </h2>
          <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Files</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-neutral-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                {patientUploads.map((upload) => (
                  <tr key={upload.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700">
                    <td className="px-4 py-3 text-sm text-neutral-900 dark:text-neutral-50">
                      {formatDate(upload.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400">
                      {upload.files.length} files
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          upload.status === 'complete' ? 'success' :
                          upload.status === 'uploaded' ? 'warning' :
                          upload.status === 'processing' ? 'info' :
                          upload.status === 'error' ? 'danger' : 'neutral'
                        }
                        size="sm"
                      >
                        {upload.status === 'complete' ? 'Analyzed' :
                         upload.status === 'uploaded' ? 'Ready' :
                         upload.status === 'processing' ? 'Processing' :
                         upload.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {upload.status === 'uploaded' ? (
                        <button
                          onClick={() => handleGenerateAnalysis(upload.id)}
                          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
                        >
                          Generate Analysis
                        </button>
                      ) : upload.status === 'complete' ? (
                        <Link
                          href={`/patients/${selectedPatientId}`}
                          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
                        >
                          View Results
                        </Link>
                      ) : (upload.status === 'processing' || upload.status === 'error') ? (
                        <button
                          onClick={() => handleDeleteUpload(upload.id)}
                          className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 font-medium"
                        >
                          Delete
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selectedPatientId && (
        <div className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-12 text-center">
          <p className="text-neutral-600 dark:text-neutral-400 mb-2">
            Select a patient to get started
          </p>
          <p className="text-sm text-neutral-500">
            You need to select a patient before uploading diagnostic files
          </p>
        </div>
      )}
    </div>
  )
}
