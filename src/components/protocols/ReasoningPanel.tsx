'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, FileText, Lightbulb, Target, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { RecommendationReasoning } from '@/types/diagnostic-extraction'

interface ReasoningPanelProps {
  recommendationId: string
  frequencyName?: string
  isOpen?: boolean
  onToggle?: () => void
}

export function ReasoningPanel({
  recommendationId,
  frequencyName,
  isOpen: controlledIsOpen,
  onToggle,
}: ReasoningPanelProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const [reasoning, setReasoning] = useState<RecommendationReasoning | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen
  const toggleOpen = onToggle || (() => setInternalIsOpen((prev) => !prev))

  const supabase = createClient()

  useEffect(() => {
    async function fetchReasoning() {
      if (!isOpen || reasoning) return

      setLoading(true)
      setError(null)

      try {
        let query = supabase
          .from('recommendation_reasoning')
          .select('*')
          .eq('protocol_recommendation_id', recommendationId)

        if (frequencyName) {
          query = query.eq('frequency_name', frequencyName)
        }

        const { data, error: fetchError } = await query.limit(1).single()

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            // No reasoning found
            setReasoning(null)
          } else {
            throw fetchError
          }
        } else if (data) {
          setReasoning({
            id: data.id,
            protocolRecommendationId: data.protocol_recommendation_id,
            frequencyName: data.frequency_name,
            ragChunksUsed: (data.rag_chunks_used as RecommendationReasoning['ragChunksUsed']) || [],
            sundayDocReferences:
              (data.sunday_doc_references as RecommendationReasoning['sundayDocReferences']) || [],
            diagnosticTriggers:
              (data.diagnostic_triggers as RecommendationReasoning['diagnosticTriggers']) || [],
            patientConditions: data.patient_conditions || [],
            reasoningSteps: (data.reasoning_steps as string[]) || [],
            confidenceScore: data.confidence_score || 0,
            validated: data.validated || false,
            validationError: data.validation_error,
            createdAt: new Date(data.created_at),
          })
        }
      } catch (err) {
        console.error('Error fetching reasoning:', err)
        setError('Failed to load reasoning data')
      } finally {
        setLoading(false)
      }
    }

    fetchReasoning()
  }, [isOpen, recommendationId, frequencyName, reasoning, supabase])

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={toggleOpen}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            How did it reach this conclusion?
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500" />
        )}
      </button>

      {/* Content */}
      {isOpen && (
        <div className="p-4 space-y-4 bg-white dark:bg-slate-900">
          {loading && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
          )}

          {error && <div className="text-sm text-red-500 dark:text-red-400">{error}</div>}

          {!loading && !error && !reasoning && (
            <div className="text-sm text-slate-500 dark:text-slate-400 italic">
              No detailed reasoning available for this recommendation.
            </div>
          )}

          {!loading && !error && reasoning && (
            <>
              {/* Validation Status */}
              <div className="flex items-center gap-2">
                {reasoning.validated ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-600 dark:text-green-400">
                      Frequency validated against approved list
                    </span>
                  </>
                ) : reasoning.validationError ? (
                  <>
                    <Target className="w-4 h-4 text-amber-500" />
                    <span className="text-sm text-amber-600 dark:text-amber-400">
                      {reasoning.validationError}
                    </span>
                  </>
                ) : null}
              </div>

              {/* Confidence Score */}
              {reasoning.confidenceScore > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Confidence:
                  </span>
                  <div className="flex-1 max-w-xs h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        reasoning.confidenceScore >= 0.8
                          ? 'bg-green-500'
                          : reasoning.confidenceScore >= 0.6
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${reasoning.confidenceScore * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {Math.round(reasoning.confidenceScore * 100)}%
                  </span>
                </div>
              )}

              {/* Reasoning Steps */}
              {reasoning.reasoningSteps.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Reasoning Chain
                  </h4>
                  <ol className="list-decimal list-inside space-y-1">
                    {reasoning.reasoningSteps.map((step, index) => (
                      <li key={index} className="text-sm text-slate-600 dark:text-slate-400">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Diagnostic Triggers */}
              {reasoning.diagnosticTriggers.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Diagnostic Triggers
                  </h4>
                  <div className="space-y-2">
                    {reasoning.diagnosticTriggers.map((trigger, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded"
                      >
                        <Target className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {trigger.type}: {trigger.finding}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Value: {trigger.value} &mdash; {trigger.interpretation}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sunday Doc References */}
              {reasoning.sundayDocReferences.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    BFM Sunday Documentation References
                  </h4>
                  <div className="space-y-2">
                    {reasoning.sundayDocReferences.map((ref, index) => (
                      <div
                        key={index}
                        className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            {ref.filename}
                          </span>
                        </div>
                        {ref.section && (
                          <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                            Section: {ref.section}
                          </div>
                        )}
                        {ref.quote && (
                          <blockquote className="text-sm text-slate-600 dark:text-slate-400 italic border-l-2 border-blue-300 pl-2">
                            &ldquo;{ref.quote}&rdquo;
                          </blockquote>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* RAG Chunks Used */}
              {reasoning.ragChunksUsed.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Knowledge Base Sources ({reasoning.ragChunksUsed.length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {reasoning.ragChunksUsed.map((chunk, index) => (
                      <div
                        key={index}
                        className="p-2 bg-slate-50 dark:bg-slate-800 rounded text-sm"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {chunk.title || 'Untitled Document'}
                          </span>
                          <span className="text-xs text-slate-500">
                            {Math.round(chunk.similarity * 100)}% match
                          </span>
                        </div>
                        {chunk.content_snippet && (
                          <p className="text-slate-600 dark:text-slate-400 text-xs line-clamp-2">
                            {chunk.content_snippet}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default ReasoningPanel
