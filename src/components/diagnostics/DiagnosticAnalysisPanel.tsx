'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Loading03Icon, AlertCircleIcon, Tick01Icon } from '@hugeicons/core-free-icons'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ProtocolRecommendationCard } from '@/components/protocols/ProtocolRecommendationCard'
import { ProtocolExecutionModal } from '@/components/protocols/ProtocolExecutionModal'
import {
  ANALYSIS_STATUS_LABELS,
  ANALYSIS_STATUS_COLORS,
  type DiagnosticAnalysisWithRecommendations,
  type ProtocolRecommendation,
} from '@/types/diagnostic-analysis'
import { cn } from '@/lib/utils'

interface DiagnosticAnalysisPanelProps {
  analysis: DiagnosticAnalysisWithRecommendations
  onRefresh?: () => void
}

export function DiagnosticAnalysisPanel({ analysis, onRefresh }: DiagnosticAnalysisPanelProps) {
  const [selectedRecommendation, setSelectedRecommendation] = useState<ProtocolRecommendation | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleExecute = (id: string) => {
    const rec = analysis.recommendations.find(r => r.id === id)
    if (rec) {
      setSelectedRecommendation(rec)
    }
  }

  const handleDecline = async (id: string) => {
    setLoadingId(id)
    try {
      const res = await fetch(`/api/protocol-recommendations/${id}`, {
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

  const handleExecutionComplete = () => {
    setSelectedRecommendation(null)
    if (onRefresh) {
      onRefresh()
    }
  }

  const statusLabel = ANALYSIS_STATUS_LABELS[analysis.status]
  const statusColor = ANALYSIS_STATUS_COLORS[analysis.status]

  // Sort recommendations by priority
  const sortedRecommendations = [...analysis.recommendations].sort(
    (a, b) => a.priority - b.priority
  )

  return (
    <div className="space-y-6">
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

      {/* Complete State - Show Summary */}
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

      {/* Protocol Recommendations */}
      {analysis.status === 'complete' && sortedRecommendations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-neutral-900">
              Recommended Protocols ({sortedRecommendations.length})
            </h4>
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <HugeiconsIcon icon={Tick01Icon} size={16} className="text-green-600" />
              <span>
                {sortedRecommendations.filter(r => r.status === 'executed').length} executed
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {sortedRecommendations.map(recommendation => (
              <ProtocolRecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                onExecute={handleExecute}
                onDecline={handleDecline}
                isLoading={loadingId === recommendation.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {analysis.status === 'complete' && sortedRecommendations.length === 0 && (
        <div className="bg-neutral-50 rounded-2xl p-8 text-center">
          <p className="text-neutral-600">No protocol recommendations generated.</p>
          <p className="text-sm text-neutral-500 mt-1">
            The analysis did not produce specific protocol recommendations based on the available data.
          </p>
        </div>
      )}

      {/* Execution Modal */}
      {selectedRecommendation && (
        <ProtocolExecutionModal
          recommendation={selectedRecommendation}
          onClose={() => setSelectedRecommendation(null)}
          onComplete={handleExecutionComplete}
        />
      )}
    </div>
  )
}
