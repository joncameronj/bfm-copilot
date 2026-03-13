'use client'

import { useState, useEffect } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Loading03Icon, FileSearchIcon, Add01Icon, AiMagicIcon, File01Icon } from '@hugeicons/core-free-icons'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { DiagnosticAnalysisPanel } from '@/components/diagnostics/DiagnosticAnalysisPanel'
import type { DiagnosticAnalysisWithRecommendations, ProtocolRecommendation } from '@/types/diagnostic-analysis'
import { formatDate, formatDateTime } from '@/lib/utils'
import { toast } from 'react-hot-toast'

interface PatientDiagnosticAnalysesProps {
  patientId: string
}

interface AnalysisData {
  id: string
  diagnostic_upload_id: string
  summary: string
  status: 'pending' | 'processing' | 'complete' | 'error'
  error_message: string | null
  supplementation?: unknown[]  // Analysis-level supplementation
  is_archived?: boolean
  archived_at?: string | null
  created_at: string
  updated_at: string
  diagnostic_uploads?: {
    id: string
    status: string
    diagnostic_files?: Array<{
      id: string
      filename: string
      file_type: string
    }>
  }
  protocol_recommendations?: Array<{
    id: string
    title: string
    description: string | null
    category: string
    recommended_frequencies: unknown[]
    supplementation: unknown[]
    priority: number
    status: 'recommended' | 'executed' | 'declined'
    created_at: string
    protocol_executions?: Array<{
      id: string
      executed_at: string
      outcome: string | null
    }>
  }>
}

interface PendingUpload {
  id: string
  status: string
  createdAt: string
  files: Array<{
    id: string
    filename: string
    fileType: string
  }>
}

export function PatientDiagnosticAnalyses({ patientId }: PatientDiagnosticAnalysesProps) {
  const [analyses, setAnalyses] = useState<AnalysisData[]>([])
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      // Fetch analyses and pending uploads in parallel
      const [analysesRes, uploadsRes] = await Promise.all([
        fetch(`/api/patients/${patientId}/analyses`),
        fetch(`/api/diagnostics?patientId=${patientId}`)
      ])

      if (analysesRes.ok) {
        const data = await analysesRes.json()
        setAnalyses(data.data || [])
        if (data.data?.length === 1) {
          setExpandedId(data.data[0].id)
        }
      }

      if (uploadsRes.ok) {
        const data = await uploadsRes.json()
        // Filter to only show uploads that don't have an analysis yet
        const analysisUploadIds = new Set(analyses.map(a => a.diagnostic_upload_id))
        const pending = (data.data || []).filter(
          (upload: PendingUpload) => !analysisUploadIds.has(upload.id) && upload.status === 'uploaded'
        )
        setPendingUploads(pending)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateAnalysis = async (uploadId: string) => {
    setGeneratingId(uploadId)
    try {
      const response = await fetch(`/api/diagnostics/${uploadId}/generate-analysis`, {
        method: 'POST',
      })

      if (!response.ok) {
        let message = 'Failed to generate analysis'
        try {
          const errorPayload = await response.json()
          message = errorPayload?.error || message
        } catch {
          // Ignore parse failures and use fallback message.
        }
        throw new Error(message)
      }

      const result = await response.json()
      const status = result?.data?.status

      if (status === 'processing') {
        toast.success('Analysis started — generating report (2-3 min)')
      } else {
        toast.success('Analysis generated successfully')
      }
      fetchData() // Refresh the data
    } catch (error) {
      console.error('Analysis generation failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate analysis')
    } finally {
      setGeneratingId(null)
    }
  }

  useEffect(() => {
    fetchData()
  }, [patientId])

  // Poll every 10s while any analysis is processing/pending
  useEffect(() => {
    const hasInProgress = analyses.some(
      (a) => a.status === 'processing' || a.status === 'pending'
    )
    if (!hasInProgress) return
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [analyses])

  const transformToAnalysisWithRecommendations = (data: AnalysisData): DiagnosticAnalysisWithRecommendations => {
    return {
      id: data.id,
      diagnosticUploadId: data.diagnostic_upload_id,
      patientId: patientId,
      practitionerId: '', // Not needed for display
      summary: data.summary,
      rawAnalysis: {},
      status: data.status,
      errorMessage: data.error_message,
      ragContext: {},
      supplementation: (data.supplementation || []) as DiagnosticAnalysisWithRecommendations['supplementation'],
      isArchived: data.is_archived || false,
      archivedAt: data.archived_at ? new Date(data.archived_at) : null,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      recommendations: (data.protocol_recommendations || []).map(rec => ({
        id: rec.id,
        diagnosticAnalysisId: data.id,
        patientId: patientId,
        title: rec.title,
        description: rec.description,
        category: rec.category as ProtocolRecommendation['category'],
        recommendedFrequencies: (rec.recommended_frequencies || []) as ProtocolRecommendation['recommendedFrequencies'],
        supplementation: (rec.supplementation || []) as ProtocolRecommendation['supplementation'],
        priority: rec.priority,
        status: rec.status,
        createdAt: new Date(rec.created_at),
        updatedAt: new Date(rec.created_at),
      })),
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <HugeiconsIcon icon={Loading03Icon} size={20} className="animate-spin text-neutral-400" />
          <span className="text-neutral-500 dark:text-neutral-400">Loading diagnostic analyses...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-neutral-100 dark:border-neutral-700">
        <div className="flex items-center gap-3">
          <HugeiconsIcon icon={FileSearchIcon} size={24} className="text-neutral-400" />
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            Diagnostic Analyses
          </h2>
          {analyses.length > 0 && (
            <span className="text-sm text-neutral-500 dark:text-neutral-400">({analyses.length})</span>
          )}
        </div>
        <Link href={`/diagnostics?patient=${patientId}`}>
          <Button variant="secondary" className="flex items-center gap-2">
            <HugeiconsIcon icon={Add01Icon} size={18} />
            New Analysis
          </Button>
        </Link>
      </div>

      {/* Pending Uploads - Ready for Analysis */}
      {pendingUploads.length > 0 && (
        <div className="border-b border-neutral-100 dark:border-neutral-700">
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20">
            <div className="flex items-center gap-2 mb-3">
              <HugeiconsIcon icon={File01Icon} size={18} className="text-yellow-600 dark:text-yellow-400" />
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                Pending Uploads ({pendingUploads.length})
              </span>
            </div>
            <div className="space-y-3">
              {pendingUploads.map((upload) => (
                <div
                  key={upload.id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-neutral-800 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                      {upload.files?.length || 0} files uploaded
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {formatDate(upload.createdAt)} •{' '}
                      {upload.files?.map(f => f.fileType.replace('_', ' ')).join(', ')}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleGenerateAnalysis(upload.id)}
                    isLoading={generatingId === upload.id}
                    className="flex items-center gap-2"
                    size="sm"
                  >
                    <HugeiconsIcon icon={AiMagicIcon} size={16} />
                    Generate Analysis
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {analyses.length === 0 && pendingUploads.length === 0 ? (
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <HugeiconsIcon icon={FileSearchIcon} size={28} className="text-neutral-400" />
          </div>
          <p className="text-neutral-600 dark:text-neutral-400 mb-2">No diagnostic analyses yet</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
            Upload diagnostic files to generate AI-powered protocol recommendations.
          </p>
          <Link href={`/diagnostics?patient=${patientId}`}>
            <Button>Upload Diagnostics</Button>
          </Link>
        </div>
      ) : analyses.length === 0 ? (
        null // Only pending uploads, no analyses - don't show empty state
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
          {analyses.map((analysis) => (
            <div key={analysis.id}>
              {/* Analysis Header */}
              <button
                onClick={() => setExpandedId(expandedId === analysis.id ? null : analysis.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-50 text-left">
                      Analysis from {formatDateTime(analysis.created_at)}
                    </p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 text-left">
                      {analysis.diagnostic_uploads?.diagnostic_files?.length || 0} files •{' '}
                      {analysis.protocol_recommendations?.length || 0} protocols
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    analysis.status === 'complete' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                    analysis.status === 'processing' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                    analysis.status === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                    'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                  }`}>
                    {analysis.status}
                  </span>
                  <svg
                    className={`w-5 h-5 text-neutral-400 transition-transform ${expandedId === analysis.id ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded Content */}
              {expandedId === analysis.id && (
                <div className="px-6 pb-6 border-t border-neutral-100 dark:border-neutral-700">
                  <DiagnosticAnalysisPanel
                    analysis={transformToAnalysisWithRecommendations(analysis)}
                    onRefresh={fetchData}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
