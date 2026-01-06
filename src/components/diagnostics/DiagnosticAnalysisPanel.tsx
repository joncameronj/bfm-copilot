'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Loading03Icon, AlertCircleIcon, Tick01Icon } from '@hugeicons/core-free-icons'
import { FrequencyRecommendationCard } from '@/components/protocols/FrequencyRecommendationCard'
import { SupplementationSection } from '@/components/diagnostics/SupplementationSection'
import { LogProtocolsFooter } from '@/components/diagnostics/LogProtocolsFooter'
import { useRoleView } from '@/providers/RoleViewProvider'
import { flattenProtocolsToFrequencyCards } from '@/lib/utils/flatten-protocols'
import {
  ANALYSIS_STATUS_LABELS,
  ANALYSIS_STATUS_COLORS,
  type DiagnosticAnalysisWithRecommendations,
  type FlattenedFrequencyCard,
} from '@/types/diagnostic-analysis'
import { cn } from '@/lib/utils'

interface DiagnosticAnalysisPanelProps {
  analysis: DiagnosticAnalysisWithRecommendations
  onRefresh?: () => void
}

export function DiagnosticAnalysisPanel({ analysis, onRefresh }: DiagnosticAnalysisPanelProps) {
  const { effectiveRole } = useRoleView()

  // Flatten protocols to frequency cards
  const [frequencyCards, setFrequencyCards] = useState<FlattenedFrequencyCard[]>(() =>
    flattenProtocolsToFrequencyCards(analysis.recommendations)
  )
  const [loadingId, setLoadingId] = useState<string | null>(null)

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
        // Analysis is now archived, refresh will remove it from view
        onRefresh()
      }
    } catch (error) {
      console.error('Failed to log protocols:', error)
    }
  }

  const statusLabel = ANALYSIS_STATUS_LABELS[analysis.status]
  const statusColor = ANALYSIS_STATUS_COLORS[analysis.status]

  const selectedCount = frequencyCards.filter(f => f.pendingExecution).length
  const isPractitionerOrAdmin = effectiveRole === 'practitioner' || effectiveRole === 'admin'

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
          <HugeiconsIcon icon={AlertCircleIcon} size={24} className="text-red-600" />
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

      {/* Frequency Cards (Flattened Protocols) */}
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

      {/* Supplementation Section (Practitioners Only) */}
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

      {/* Sticky Footer for Logging */}
      <LogProtocolsFooter
        selectedCount={selectedCount}
        onLog={handleLogProtocols}
      />
    </div>
  )
}
