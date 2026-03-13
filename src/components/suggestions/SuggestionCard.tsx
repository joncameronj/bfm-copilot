'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ThumbsUpIcon, ThumbsDownIcon, Loading03Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

interface Suggestion {
  id: string
  content: string
  category?: string | null
  status: 'pending' | 'accepted' | 'rejected' | 'superseded'
  sourceContext?: string | null
  iterationCount: number
  createdAt: Date
}

interface SuggestionCardProps {
  suggestion: Suggestion
  onStatusChange: (id: string, status: 'accepted' | 'rejected') => void
}

export function SuggestionCard({ suggestion, onStatusChange }: SuggestionCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')

  const handleFeedback = async (rating: 'thumbs_up' | 'thumbs_down') => {
    if (rating === 'thumbs_down') {
      setShowFeedback(true)
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/suggestions/${suggestion.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      })

      if (res.ok) {
        onStatusChange(suggestion.id, 'accepted')
      }
    } catch (error) {
      console.error('Error submitting feedback:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitNegativeFeedback = async () => {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/suggestions/${suggestion.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 'thumbs_down', feedbackText }),
      })

      if (res.ok) {
        onStatusChange(suggestion.id, 'rejected')
        setShowFeedback(false)
      }
    } catch (error) {
      console.error('Error submitting feedback:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const statusColors = {
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    accepted: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    superseded: 'bg-neutral-50 text-neutral-500 border-neutral-200',
  }

  const categoryLabels: Record<string, string> = {
    lifestyle: 'Lifestyle',
    nutrition: 'Nutrition',
    exercise: 'Exercise',
    supplement: 'Supplement',
    sleep: 'Sleep',
    light: 'Light Exposure',
    environment: 'Environment',
    stress: 'Stress Management',
    general: 'General Wellness',
  }

  // Parse module reference from sourceContext JSON
  const moduleRef = (() => {
    if (!suggestion.sourceContext) return null
    try {
      const parsed = JSON.parse(suggestion.sourceContext)
      return parsed.module as string | undefined
    } catch {
      return null
    }
  })()

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={cn('px-2 py-1 text-xs font-medium rounded-full border', statusColors[suggestion.status])}>
            {suggestion.status}
          </span>
          {suggestion.category && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {categoryLabels[suggestion.category] || suggestion.category}
            </span>
          )}
          {moduleRef && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              {moduleRef}
            </span>
          )}
          {suggestion.iterationCount > 0 && (
            <span className="text-xs text-neutral-500">
              Iteration {suggestion.iterationCount + 1}
            </span>
          )}
        </div>
        <span className="text-xs text-neutral-400">
          {new Date(suggestion.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* Content */}
      <div className="prose prose-sm max-w-none mb-4">
        <p className="text-neutral-700 whitespace-pre-wrap">{suggestion.content}</p>
      </div>

      {/* Actions */}
      {suggestion.status === 'pending' && !showFeedback && (
        <div className="flex items-center gap-3 pt-4 border-t border-neutral-100">
          <span className="text-sm text-neutral-600">Was this helpful?</span>
          <button
            onClick={() => handleFeedback('thumbs_up')}
            disabled={isSubmitting}
            className="p-2 rounded-lg hover:bg-green-50 text-neutral-400 hover:text-green-600 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? <HugeiconsIcon icon={Loading03Icon} size={20} className="animate-spin" /> : <HugeiconsIcon icon={ThumbsUpIcon} size={20} />}
          </button>
          <button
            onClick={() => handleFeedback('thumbs_down')}
            disabled={isSubmitting}
            className="p-2 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            <HugeiconsIcon icon={ThumbsDownIcon} size={20} />
          </button>
        </div>
      )}

      {/* Feedback form */}
      {showFeedback && (
        <div className="pt-4 border-t border-neutral-100 space-y-3">
          <p className="text-sm text-neutral-600">What didn&apos;t work for you?</p>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Tell us what happened..."
            className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={submitNegativeFeedback}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
            <button
              onClick={() => setShowFeedback(false)}
              className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
