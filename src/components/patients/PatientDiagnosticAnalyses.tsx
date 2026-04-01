'use client'

import { useState, useEffect, useCallback } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Loading03Icon, FileSearchIcon, Add01Icon, AiMagicIcon, File01Icon, Delete02Icon } from '@hugeicons/core-free-icons'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { DiagnosticAnalysisPanel } from '@/components/diagnostics/DiagnosticAnalysisPanel'
import { BloodPanelUpload } from '@/components/patients/BloodPanelUpload'
import type { DiagnosticAnalysisWithRecommendations, ProtocolRecommendation } from '@/types/diagnostic-analysis'
import { formatDate, formatDateTime } from '@/lib/utils'
import { toast } from 'react-hot-toast'

function ProcessingBadge({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState(() =>
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
  )

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [createdAt])

  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const timeLabel = mins > 0
    ? `${mins}:${String(secs).padStart(2, '0')}`
    : `${secs}s`

  // Indeterminate progress bar that cycles every 90s (typical analysis time)
  const progressPct = Math.min((elapsed / 90) * 100, 95)

  return (
    <div className="flex flex-col items-end gap-1 min-w-[110px]">
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-xs text-blue-700 dark:text-blue-400 font-medium">processing</span>
        <span className="text-xs text-blue-500 dark:text-blue-500 tabular-nums">{timeLabel}</span>
      </div>
      <div className="w-full h-1 bg-blue-100 dark:bg-blue-900/40 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  )
}

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

  const fetchData = useCallback(async () => {
    try {
      // Fetch analyses and pending uploads in parallel
      const [analysesRes, uploadsRes] = await Promise.all([
        fetch(`/api/patients/${patientId}/analyses`),
        fetch(`/api/diagnostics?patientId=${patientId}`)
      ])

      if (analysesRes.ok) {
        const data = await analysesRes.json()
        const nextAnalyses = data.data || []
        setAnalyses(nextAnalyses)
        if (nextAnalyses.length === 1) {
          setExpandedId(nextAnalyses[0].id)
        }

        if (uploadsRes.ok) {
          const uploadsData = await uploadsRes.json()
          // Filter to only show uploads that don't have an analysis yet
          const analysisUploadIds = new Set(
            nextAnalyses.map((analysis: AnalysisData) => analysis.diagnostic_upload_id)
          )
          const pending = (uploadsData.data || []).filter(
            (upload: PendingUpload) => !analysisUploadIds.has(upload.id) && upload.status === 'uploaded'
          )
          setPendingUploads(pending)
        } else {
          setPendingUploads([])
        }
      } else {
        setAnalyses([])
        setPendingUploads([])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [patientId])

  const pollInProgressAnalyses = useCallback(async (inProgressAnalyses: AnalysisData[]) => {
    const results = await Promise.allSettled(
      inProgressAnalyses.map(async (analysis) => {
        const response = await fetch(`/api/diagnostics/${analysis.id}/generate-analysis`)
        if (response.status === 404) {
          // Analysis was deleted — skip silently, fetchData will clean up state
          return null
        }
        if (!response.ok) {
          throw new Error(`Status poll failed for analysis ${analysis.id}`)
        }
        return response.json()
      })
    )

    const failedPoll = results.find((result) => result.status === 'rejected')
    if (failedPoll) {
      console.error('Failed to poll in-progress analyses:', (failedPoll as PromiseRejectedResult).reason)
    }

    await fetchData()
  }, [fetchData])

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

  const handleDeleteAnalysis = async (uploadId: string) => {
    if (!confirm('Delete this upload and its analysis?')) return
    try {
      const res = await fetch(`/api/diagnostics/${uploadId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      toast.success('Analysis deleted')
      fetchData()
    } catch {
      toast.error('Failed to delete analysis')
    }
  }

  const handleDeleteUpload = async (uploadId: string) => {
    if (!confirm('Remove this pending upload?')) return
    try {
      const res = await fetch(`/api/diagnostics/${uploadId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      toast.success('Upload removed')
      fetchData()
    } catch {
      toast.error('Failed to remove upload')
    }
  }

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Poll every 10s while any analysis is processing/pending.
  // Hitting the finalize endpoint is what transitions completed evals out of "processing".
  useEffect(() => {
    const inProgressAnalyses = analyses.filter(
      (analysis) => analysis.status === 'processing' || analysis.status === 'pending'
    )
    if (inProgressAnalyses.length === 0) return

    const interval = setInterval(() => {
      void pollInProgressAnalyses(inProgressAnalyses)
    }, 10000)

    return () => clearInterval(interval)
  }, [analyses, pollInProgressAnalyses])

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

      {/* Blood Panel Upload — primary fast path for lab PDFs */}
      <div className="p-4 border-b border-neutral-100 dark:border-neutral-700">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
          Blood Panel
        </p>
        <BloodPanelUpload
          patientId={patientId}
          onComplete={fetchData}
        />
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
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleGenerateAnalysis(upload.id)}
                      isLoading={generatingId === upload.id}
                      className="flex items-center gap-2"
                      size="sm"
                    >
                      <HugeiconsIcon icon={AiMagicIcon} size={16} />
                      Generate Analysis
                    </Button>
                    <button
                      onClick={() => handleDeleteUpload(upload.id)}
                      className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove this upload"
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {analyses.length === 0 && pendingUploads.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Drop a blood panel PDF above to start, or{' '}
            <Link href={`/diagnostics?patient=${patientId}`} className="underline hover:text-neutral-700">
              upload other diagnostics
            </Link>
            .
          </p>
        </div>
      ) : analyses.length === 0 ? (
        null // Only pending uploads — no analyses yet
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
          {analyses.map((analysis) => (
            <div key={analysis.id}>
              {/* Analysis Header */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpandedId(expandedId === analysis.id ? null : analysis.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(expandedId === analysis.id ? null : analysis.id) } }}
                className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
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
                  {analysis.status === 'processing' ? (
                    <ProcessingBadge createdAt={analysis.created_at} />
                  ) : (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      analysis.status === 'complete' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                      analysis.status === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                      'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                    }`}>
                      {analysis.status}
                    </span>
                  )}
                  {(analysis.status === 'processing' || analysis.status === 'error') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteAnalysis(analysis.diagnostic_upload_id)
                      }}
                      className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 font-medium px-2 py-1"
                    >
                      Delete
                    </button>
                  )}
                  <svg
                    className={`w-5 h-5 text-neutral-400 transition-transform ${expandedId === analysis.id ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedId === analysis.id && (
                <div className="px-6 pb-6 border-t border-neutral-100 dark:border-neutral-700">
                  <DiagnosticAnalysisPanel
                    analysis={transformToAnalysisWithRecommendations(analysis)}
                    onRefresh={fetchData}
                    onCancel={() => handleDeleteAnalysis(analysis.diagnostic_upload_id)}
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
