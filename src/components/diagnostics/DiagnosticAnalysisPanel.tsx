'use client'

import { useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert01Icon,
  File01Icon,
  Loading03Icon,
  Tick01Icon,
} from '@hugeicons/core-free-icons'
import { FrequencyRecommendationCard } from '@/components/protocols/FrequencyRecommendationCard'
import { SupplementationSection } from '@/components/diagnostics/SupplementationSection'
import { LogProtocolsFooter } from '@/components/diagnostics/LogProtocolsFooter'
import { DiagnosticEvalReport } from '@/components/diagnostics/DiagnosticEvalReport'
import { LayerQuickRefModal } from '@/components/diagnostics/LayerQuickRefModal'
import { useRoleView } from '@/providers/RoleViewProvider'
import { flattenProtocolsToFrequencyCards } from '@/lib/utils/flatten-protocols'
import {
  ANALYSIS_STATUS_LABELS,
  ANALYSIS_STATUS_COLORS,
  type DiagnosticAnalysisWithRecommendations,
  type FlattenedFrequencyCard,
} from '@/types/diagnostic-analysis'
import { cn } from '@/lib/utils'
import type { EvalReportData } from './DiagnosticEvalReportPdf'

interface DiagnosticAnalysisPanelProps {
  analysis: DiagnosticAnalysisWithRecommendations
  onRefresh?: () => void
}

type EvalState =
  | { phase: 'idle' }
  | { phase: 'generating' }
  | { phase: 'polling'; jobId: string }
  | { phase: 'complete'; report: EvalReportData }
  | { phase: 'error'; message: string }

export function DiagnosticAnalysisPanel({ analysis, onRefresh }: DiagnosticAnalysisPanelProps) {
  const { effectiveRole } = useRoleView()

  const [frequencyCards, setFrequencyCards] = useState<FlattenedFrequencyCard[]>(() =>
    flattenProtocolsToFrequencyCards(analysis.recommendations)
  )
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [evalState, setEvalState] = useState<EvalState>({ phase: 'idle' })
  const [showReport, setShowReport] = useState(false)
  const [showQuickView, setShowQuickView] = useState(false)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isPractitionerOrAdmin = effectiveRole === 'practitioner' || effectiveRole === 'admin'

  // On mount, check if an eval report already exists for this analysis
  useEffect(() => {
    const checkExisting = async () => {
      try {
        const res = await fetch(`/api/diagnostics/${analysis.id}/report`)
        if (!res.ok) return
        const { data } = await res.json()
        if (!data) return

        if (data.status === 'complete' && data.report) {
          setEvalState({ phase: 'complete', report: _mapReport(data.report) })
        } else if (data.status === 'pending' || data.status === 'processing') {
          setEvalState({ phase: 'polling', jobId: data.id })
        }
      } catch {
        // Silent — no report yet
      }
    }

    if (analysis.status === 'complete') {
      checkExisting()
    }
  }, [analysis.id, analysis.status])

  // Poll for eval completion
  useEffect(() => {
    if (evalState.phase !== 'polling') {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      return
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/diagnostics/${analysis.id}/report`)
        if (!res.ok) return
        const { data } = await res.json()
        if (!data) return

        if (data.status === 'complete' && data.report) {
          setEvalState({ phase: 'complete', report: _mapReport(data.report) })
        } else if (data.status === 'error') {
          setEvalState({ phase: 'error', message: data.errorMessage || 'Eval failed' })
        }
      } catch {
        // Keep polling
      }
    }

    pollIntervalRef.current = setInterval(poll, 15_000) // Poll every 15s
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [evalState.phase, analysis.id])

  const handleGenerateReport = async () => {
    setEvalState({ phase: 'generating' })
    try {
      const res = await fetch(`/api/diagnostics/${analysis.id}/generate-report`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = await res.json()
        setEvalState({ phase: 'error', message: body.error || 'Failed to queue report' })
        return
      }
      const { data } = await res.json()
      setEvalState({ phase: 'polling', jobId: data.jobId })
    } catch (err) {
      setEvalState({
        phase: 'error',
        message: err instanceof Error ? err.message : 'Failed to generate report',
      })
    }
  }

  const handleToggleExecution = (frequencyId: string) => {
    setFrequencyCards(prev =>
      prev.map(card =>
        card.frequencyId === frequencyId
          ? { ...card, pendingExecution: !card.pendingExecution }
          : card
      )
    )
  }

  const handleDecline = async (originalProtocolId: string) => {
    setLoadingId(originalProtocolId)
    try {
      const res = await fetch(`/api/protocol-recommendations/${originalProtocolId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'declined' }),
      })
      if (res.ok && onRefresh) {
        onRefresh()
      }
    } catch (error) {
      console.error('Failed to decline recommendation:', error)
    } finally {
      setLoadingId(null)
    }
  }

  const handleLogProtocols = async () => {
    const selectedFrequencies = frequencyCards.filter(f => f.pendingExecution)
    if (selectedFrequencies.length === 0) return

    try {
      const res = await fetch(`/api/diagnostics/${analysis.id}/log-protocols`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagnosticAnalysisId: analysis.id,
          patientId: analysis.patientId,
          frequencies: selectedFrequencies.map(f => ({
            protocolRecommendationId: f.originalProtocolId,
            frequencyId: f.frequencyId,
            frequencyName: f.frequencyName,
          })),
          sessionDate: new Date().toISOString().split('T')[0],
          effect: 'pending',
        }),
      })
      if (res.ok && onRefresh) {
        onRefresh()
      }
    } catch (error) {
      console.error('Failed to log protocols:', error)
    }
  }

  const statusLabel = ANALYSIS_STATUS_LABELS[analysis.status]
  const statusColor = ANALYSIS_STATUS_COLORS[analysis.status]
  const selectedCount = frequencyCards.filter(f => f.pendingExecution).length

  // If report viewer is open, show it fullscreen
  if (showReport && evalState.phase === 'complete') {
    return (
      <div className="space-y-6 pb-24">
        <DiagnosticEvalReport
          report={evalState.report}
          diagnosticAnalysisId={analysis.id}
          onClose={() => setShowReport(false)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-neutral-900">AI Analysis</h3>
          <span className={cn('px-2 py-1 text-xs font-medium rounded-full', statusColor)}>
            {statusLabel}
          </span>
        </div>
        {analysis.createdAt && (
          <span className="text-sm text-neutral-500">
            Generated {new Date(analysis.createdAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Processing State */}
      {analysis.status === 'processing' && (
        <div className="bg-blue-50 rounded-2xl p-6 flex items-center gap-4">
          <HugeiconsIcon icon={Loading03Icon} size={24} className="text-blue-600 animate-spin" />
          <div>
            <p className="font-medium text-blue-900">Analysis in progress</p>
            <p className="text-sm text-blue-700">
              Dr. Rob is analyzing the diagnostic files and generating protocol recommendations...
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {analysis.status === 'error' && (
        <div className="bg-red-50 rounded-2xl p-6 flex items-center gap-4">
          <HugeiconsIcon icon={Alert01Icon} size={24} className="text-red-600" />
          <div>
            <p className="font-medium text-red-900">Analysis failed</p>
            <p className="text-sm text-red-700">
              {analysis.errorMessage || 'An error occurred during analysis. Please try again.'}
            </p>
          </div>
        </div>
      )}

      {/* Summary */}
      {analysis.status === 'complete' && analysis.summary && (
        <div className="bg-neutral-50 rounded-2xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-brand-blue/10 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">🩺</span>
            </div>
            <div>
              <p className="font-medium text-neutral-900">Dr. Rob&apos;s Analysis</p>
              <p className="text-sm text-neutral-500">Based on diagnostic files and medical knowledge base</p>
            </div>
          </div>
          <div className="prose prose-sm max-w-none">
            <p className="text-neutral-700 whitespace-pre-wrap">{analysis.summary}</p>
          </div>
        </div>
      )}

      {/* Full Eval Report — only available to practitioners/admins when analysis is complete */}
      {analysis.status === 'complete' && isPractitionerOrAdmin && (
        <EvalReportSection
          evalState={evalState}
          onGenerate={handleGenerateReport}
          onView={() => setShowReport(true)}
          onQuickView={() => setShowQuickView(true)}
        />
      )}

      {/* Quick View Modal */}
      {showQuickView && evalState.phase === 'complete' && (
        <LayerQuickRefModal
          report={evalState.report}
          onClose={() => setShowQuickView(false)}
          onViewFull={() => {
            setShowQuickView(false)
            setShowReport(true)
          }}
          onDownloadPdf={async () => {
            try {
              const res = await fetch(`/api/diagnostics/${analysis.id}/export-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ report: evalState.report }),
              })
              if (!res.ok) return
              const blob = await res.blob()
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `bfm-eval-${evalState.report.patientName.replace(/\s+/g, '-').toLowerCase()}.pdf`
              a.click()
              URL.revokeObjectURL(url)
            } catch (err) {
              console.error('PDF download failed:', err)
            }
          }}
        />
      )}

      {/* Frequency Cards */}
      {analysis.status === 'complete' && frequencyCards.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-neutral-900">
              FSM Frequency Protocols ({frequencyCards.length})
            </h4>
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <HugeiconsIcon icon={Tick01Icon} size={16} className="text-emerald-600" />
              <span>
                {frequencyCards.filter(f => f.status === 'executed').length} executed
              </span>
            </div>
          </div>
          <div className="space-y-4">
            {frequencyCards.map(frequency => (
              <FrequencyRecommendationCard
                key={frequency.frequencyId}
                frequency={frequency}
                onToggleExecution={handleToggleExecution}
                onDecline={handleDecline}
                isLoading={loadingId === frequency.originalProtocolId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Supplementation (Practitioners Only) */}
      {analysis.status === 'complete' && isPractitionerOrAdmin && analysis.supplementation && analysis.supplementation.length > 0 && (
        <SupplementationSection supplementation={analysis.supplementation} />
      )}

      {/* Empty State */}
      {analysis.status === 'complete' && frequencyCards.length === 0 && (
        <div className="bg-neutral-50 rounded-2xl p-8 text-center">
          <p className="text-neutral-600">No protocol recommendations generated.</p>
          <p className="text-sm text-neutral-500 mt-1">
            The analysis did not produce specific protocol recommendations based on the available data.
          </p>
        </div>
      )}

      {/* Sticky Footer */}
      <LogProtocolsFooter
        selectedCount={selectedCount}
        onLog={handleLogProtocols}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Eval Report Section — shown below the summary when analysis is complete
// ---------------------------------------------------------------------------

interface EvalReportSectionProps {
  evalState: EvalState
  onGenerate: () => void
  onView: () => void
  onQuickView: () => void
}

function EvalReportSection({ evalState, onGenerate, onView, onQuickView }: EvalReportSectionProps) {
  if (evalState.phase === 'idle') {
    return (
      <div className="border border-dashed border-neutral-300 rounded-2xl p-5 flex items-center justify-between">
        <div>
          <p className="font-medium text-neutral-900">Full Clinical Eval Report</p>
          <p className="text-sm text-neutral-500 mt-0.5">
            Claude Opus 4.6 · All 9 master protocols · Deep clinical analysis · ~3 min
          </p>
        </div>
        <button
          onClick={onGenerate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <HugeiconsIcon icon={File01Icon} size={16} />
          Generate Full Report
        </button>
      </div>
    )
  }

  if (evalState.phase === 'generating' || evalState.phase === 'polling') {
    return (
      <div className="bg-blue-50 rounded-2xl p-5 flex items-center gap-4">
        <HugeiconsIcon icon={Loading03Icon} size={24} className="text-blue-600 animate-spin" />
        <div>
          <p className="font-medium text-blue-900">Generating full eval report...</p>
          <p className="text-sm text-blue-700">
            Claude Opus 4.6 is analyzing all 9 master protocol files against your patient data.
            This takes approximately 3 minutes.
          </p>
        </div>
      </div>
    )
  }

  if (evalState.phase === 'error') {
    return (
      <div className="bg-red-50 rounded-2xl p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <HugeiconsIcon icon={Alert01Icon} size={20} className="text-red-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-900">Report generation failed</p>
            <p className="text-sm text-red-700">{evalState.message}</p>
          </div>
        </div>
        <button
          onClick={onGenerate}
          className="flex-shrink-0 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (evalState.phase === 'complete') {
    const urgency = evalState.report.urgency
    const phases = evalState.report.frequencyPhases
    const layerCounts = {
      1: phases.filter(p => p.phase === 1).length,
      2: phases.filter(p => p.phase === 2).length,
      3: phases.filter(p => p.phase === 3).length,
    }
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HugeiconsIcon icon={Tick01Icon} size={20} className="text-emerald-600" />
          <div>
            <p className="font-medium text-neutral-900">Full Eval Report Ready</p>
            <p className="text-sm text-neutral-600">
              Urgency {urgency.score}/5 · {evalState.report.dealBreakers.length} deal breakers ·{' '}
              L1: {layerCounts[1]} · L2: {layerCounts[2]} · L3: {layerCounts[3]} protocols
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onQuickView}
            className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-sm font-medium transition-colors"
          >
            Quick View
          </button>
          <button
            onClick={onView}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <HugeiconsIcon icon={File01Icon} size={16} />
            Open Report
          </button>
        </div>
      </div>
    )
  }

  return null
}

// ---------------------------------------------------------------------------
// Map Python snake_case EvalReport → TypeScript camelCase EvalReportData
// ---------------------------------------------------------------------------

function _mapReport(r: Record<string, unknown>): EvalReportData {
  const urgency = (r.urgency ?? {}) as Record<string, unknown>
  return {
    patientName: (r.patient_name as string) ?? '',
    reportDate: (r.report_date as string) ?? new Date().toISOString().split('T')[0],
    urgency: {
      score: (urgency.score as number) ?? 0,
      rationale: (urgency.rationale as string) ?? '',
      timeline: (urgency.timeline as string) ?? '',
      criticalPath: (urgency.critical_path as string) ?? '',
    },
    dealBreakers: ((r.deal_breakers as unknown[]) ?? []).map((d: unknown) => {
      const db = d as Record<string, unknown>
      return {
        name: db.name as string,
        finding: db.finding as string,
        protocol: db.protocol as string,
        urgency: db.urgency as string,
        patientDataCitation: (db.patient_data_citation as string) ?? '',
      }
    }),
    frequencyPhases: ((r.frequency_phases as unknown[]) ?? []).map((p: unknown) => {
      const fp = p as Record<string, unknown>
      return {
        phase: (fp.phase as number) ?? 2,
        protocolName: fp.protocol_name as string,
        trigger: fp.trigger as string,
        patientDataCitation: (fp.patient_data_citation as string) ?? '',
        sequencingNote: (fp.sequencing_note as string) ?? '',
        layerLabel: (fp.layer_label as string) ?? '',
        layerDescription: (fp.layer_description as string) ?? '',
      }
    }),
    supplementation: ((r.supplementation as unknown[]) ?? []).map((s: unknown) => {
      const sup = s as Record<string, unknown>
      return {
        name: sup.name as string,
        trigger: sup.trigger as string,
        dosage: (sup.dosage as string) ?? '',
        timing: (sup.timing as string) ?? '',
        patientDataCitation: (sup.patient_data_citation as string) ?? '',
        priority: (sup.priority as number) ?? 2,
        layer: (sup.layer as number) ?? 0,
      }
    }),
    fiveLevers: ((r.five_levers as unknown[]) ?? []).map((l: unknown) => {
      const lv = l as Record<string, unknown>
      return {
        leverNumber: lv.lever_number as number,
        leverName: lv.lever_name as string,
        patientStatus: lv.patient_status as string,
        recommendation: lv.recommendation as string,
        patientDataCitation: (lv.patient_data_citation as string) ?? '',
      }
    }),
    patientAnalogies: ((r.patient_analogies as unknown[]) ?? []).map((a: unknown) => {
      const an = a as Record<string, unknown>
      return {
        finding: an.finding as string,
        analogy: an.analogy as string,
        whatThisMeans: an.what_this_means as string,
        hopefulFraming: an.hopeful_framing as string,
      }
    }),
    monitoring: ((r.monitoring as unknown[]) ?? []).map((m: unknown) => {
      const mo = m as Record<string, unknown>
      return {
        metric: mo.metric as string,
        baseline: mo.baseline as string,
        target: mo.target as string,
        reassessmentInterval: mo.reassessment_interval as string,
      }
    }),
    clinicalSummary: (r.clinical_summary as string) ?? '',
    confidenceNotes: (r.confidence_notes as string) ?? '',
  }
}
