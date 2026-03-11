'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert01Icon,
  File01Icon,
  Loading03Icon,
  PillIcon,
  Tick01Icon,
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/Button'
import { FrequencyRecommendationCard } from '@/components/protocols/FrequencyRecommendationCard'
import { LogProtocolsFooter } from '@/components/diagnostics/LogProtocolsFooter'
import { CopilotReportModal } from '@/components/diagnostics/CopilotReportModal'
import type { CopilotReportData } from '@/components/diagnostics/CopilotReportModal'
import { useRoleView } from '@/providers/RoleViewProvider'
import { flattenProtocolsToFrequencyCards } from '@/lib/utils/flatten-protocols'
import {
  ANALYSIS_STATUS_LABELS,
  ANALYSIS_STATUS_COLORS,
  type DiagnosticAnalysisWithRecommendations,
  type FlattenedFrequencyCard,
  type Supplementation,
} from '@/types/diagnostic-analysis'
import { cn } from '@/lib/utils'

interface DiagnosticAnalysisPanelProps {
  analysis: DiagnosticAnalysisWithRecommendations
  onRefresh?: () => void
}

export function DiagnosticAnalysisPanel({ analysis, onRefresh }: DiagnosticAnalysisPanelProps) {
  const { effectiveRole } = useRoleView()

  const [frequencyCards, setFrequencyCards] = useState<FlattenedFrequencyCard[]>(() =>
    flattenProtocolsToFrequencyCards(analysis.recommendations)
  )
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)

  const isPractitionerOrAdmin = effectiveRole === 'practitioner' || effectiveRole === 'admin'

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

  // Build report data from the existing analysis for the CoPilot report modal
  const buildReportData = (): CopilotReportData => {
    const patientName = analysis.patient
      ? `${analysis.patient.firstName} ${analysis.patient.lastName}`
      : 'Patient'

    // Extract eval report from raw_analysis if present
    const rawAnalysis = analysis.rawAnalysis as Record<string, unknown> | undefined
    const evalReport = rawAnalysis?.eval_report as CopilotReportData['evalReport'] | undefined

    return {
      patientName,
      analysisDate: new Date(analysis.createdAt).toLocaleDateString(),
      summary: analysis.summary,
      protocols: analysis.recommendations.map(rec => ({
        title: rec.title,
        category: rec.category,
        priority: rec.priority,
        layer: rec.priority,
        frequencies: rec.recommendedFrequencies.map(f => ({
          name: f.name,
          rationale: f.rationale,
          diagnosticTrigger: f.diagnostic_trigger,
        })),
      })),
      supplementation: analysis.supplementation || [],
      evalReport,
    }
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
              Copilot is analyzing the diagnostic files and generating protocol recommendations...
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
              <p className="font-medium text-neutral-900">Copilot&apos;s Analysis</p>
              <p className="text-sm text-neutral-500">Based on diagnostic files and medical knowledge base</p>
            </div>
          </div>
          <div className="prose prose-sm max-w-none">
            <p className="text-neutral-800 font-medium leading-relaxed whitespace-pre-wrap">{analysis.summary}</p>
          </div>
        </div>
      )}

      {/* View Report button — available to practitioners/admins when analysis is complete */}
      {analysis.status === 'complete' && isPractitionerOrAdmin && (
        <div className="border border-dashed border-neutral-300 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="font-medium text-neutral-900">CoPilot Analysis Report</p>
            <p className="text-sm text-neutral-500 mt-0.5">
              Summary, layered protocols, and supplements — ready to view or download as PDF
            </p>
          </div>
          <Button
            onClick={() => setShowReport(true)}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <HugeiconsIcon icon={File01Icon} size={16} />
            View Report
          </Button>
        </div>
      )}

      {/* CoPilot Report Modal */}
      {showReport && analysis.status === 'complete' && (
        <CopilotReportModal
          data={buildReportData()}
          diagnosticAnalysisId={analysis.id}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* Layered Protocols & Supplementation */}
      {analysis.status === 'complete' && (
        <LayeredProtocolsSection
          frequencyCards={frequencyCards}
          supplementation={isPractitionerOrAdmin ? (analysis.supplementation || []) : []}
          onToggleExecution={handleToggleExecution}
          onDecline={handleDecline}
          loadingId={loadingId}
        />
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
// Layered Protocols & Supplementation Section
// ---------------------------------------------------------------------------

const LAYER_GROUPS = [
  {
    layer: 1,
    label: 'Layer 1 — High Priorities',
    colorClass: 'bg-red-50 text-red-700',
    dividerClass: 'bg-red-200',
  },
  {
    layer: 2,
    label: 'Layer 2 — Next If No Response',
    colorClass: 'bg-amber-50 text-amber-700',
    dividerClass: 'bg-amber-200',
  },
  {
    layer: 3,
    label: 'Layer 3 — If They Are Still Stuck',
    colorClass: 'bg-neutral-100 text-neutral-600',
    dividerClass: 'bg-neutral-300',
  },
]

interface LayeredProtocolsSectionProps {
  frequencyCards: FlattenedFrequencyCard[]
  supplementation: Supplementation[]
  onToggleExecution: (id: string) => void
  onDecline: (id: string) => void
  loadingId: string | null
}

function LayeredProtocolsSection({
  frequencyCards,
  supplementation,
  onToggleExecution,
  onDecline,
  loadingId,
}: LayeredProtocolsSectionProps) {
  const executedCount = frequencyCards.filter(f => f.status === 'executed').length
  const hasContent = frequencyCards.length > 0 || supplementation.length > 0

  if (!hasContent) {
    return (
      <div className="bg-neutral-50 rounded-2xl p-8 text-center">
        <p className="text-neutral-600">No protocol recommendations generated.</p>
        <p className="text-sm text-neutral-500 mt-1">
          The analysis did not produce specific protocol recommendations based on the available data.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-neutral-900">
          Protocols for Copilot
        </h4>
        {executedCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <HugeiconsIcon icon={Tick01Icon} size={16} className="text-emerald-600" />
            <span>{executedCount} executed</span>
          </div>
        )}
      </div>

      {LAYER_GROUPS.map(({ layer, label, colorClass, dividerClass }) => {
        const layerCards = frequencyCards.filter(c =>
          layer === 3 ? c.priority >= 3 : c.priority === layer
        )
        // Layer 1 also captures unassigned supplements (layer=0 or undefined)
        const layerSupps = supplementation.filter(s =>
          layer === 1
            ? s.layer === 1 || !s.layer || s.layer === 0
            : s.layer === layer
        )

        if (layerCards.length === 0 && layerSupps.length === 0) return null

        return (
          <div key={layer} className="space-y-3">
            {/* Layer header */}
            <div className="flex items-center gap-3">
              <div className={cn('h-px flex-1', dividerClass)} />
              <span className={cn('text-xs font-bold tracking-wider uppercase px-3 py-1 rounded-full whitespace-nowrap', colorClass)}>
                {label}
              </span>
              <div className={cn('h-px flex-1', dividerClass)} />
            </div>

            {/* Frequency cards */}
            {layerCards.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {layerCards.map(frequency => (
                  <FrequencyRecommendationCard
                    key={frequency.frequencyId}
                    frequency={frequency}
                    onToggleExecution={onToggleExecution}
                    onDecline={onDecline}
                    isLoading={loadingId === frequency.originalProtocolId}
                  />
                ))}
              </div>
            )}

            {/* Supplement cards */}
            {layerSupps.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2">
                {layerSupps.map((supp, idx) => (
                  <div key={idx} className="bg-white border border-neutral-200 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <HugeiconsIcon icon={PillIcon} size={16} className="text-neutral-500" />
                      <h5 className="font-semibold text-neutral-900 text-sm">{supp.name}</h5>
                    </div>
                    <div className="space-y-1 text-xs text-neutral-600">
                      {supp.dosage && (
                        <p><span className="font-medium text-neutral-700">Dosage:</span> {supp.dosage}</p>
                      )}
                      {supp.timing && (
                        <p><span className="font-medium text-neutral-700">Timing:</span> {supp.timing}</p>
                      )}
                      {supp.rationale && (
                        <p className="pt-1 border-t border-neutral-100 text-neutral-600 leading-relaxed">{supp.rationale}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
