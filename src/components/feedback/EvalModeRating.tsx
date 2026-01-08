'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Tick01Icon, Alert01Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { EvalCommentModal } from './EvalCommentModal'
import type { EvaluationRating, EvaluationContentType } from '@/types/eval-mode'

interface EvalModeRatingProps {
  messageId: string
  conversationId: string
  content: string
  contentType?: EvaluationContentType
  patientId?: string
}

// Rating configuration with labels, colors, and icons
const RATINGS: Array<{
  value: EvaluationRating
  label: string
  color: string
  bgColor: string
  borderColor: string
  hoverBg: string
  activeBg: string
  icon: typeof Tick01Icon
}> = [
  {
    value: 'correct',
    label: 'Correct',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    hoverBg: 'hover:bg-blue-100',
    activeBg: 'bg-blue-100',
    icon: Tick01Icon,
  },
  {
    value: 'partially_correct',
    label: 'Partially Correct',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    hoverBg: 'hover:bg-green-100',
    activeBg: 'bg-green-100',
    icon: Tick01Icon,
  },
  {
    value: 'partially_fail',
    label: 'Partially Fail',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    hoverBg: 'hover:bg-yellow-100',
    activeBg: 'bg-yellow-100',
    icon: Alert01Icon,
  },
  {
    value: 'fail',
    label: 'Fail',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    hoverBg: 'hover:bg-red-100',
    activeBg: 'bg-red-100',
    icon: Cancel01Icon,
  },
]

export function EvalModeRating({
  messageId,
  conversationId,
  content,
  contentType = 'chat_response',
  patientId,
}: EvalModeRatingProps) {
  const [selectedRating, setSelectedRating] = useState<EvaluationRating | null>(null)
  const [submittedRating, setSubmittedRating] = useState<EvaluationRating | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRatingClick = (rating: EvaluationRating) => {
    if (submittedRating) return // Already submitted

    setSelectedRating(rating)
    setError(null)

    if (rating === 'correct') {
      // Submit immediately for 'correct' rating
      handleSubmit(rating, '', '')
    } else {
      // Open modal for comment
      setIsModalOpen(true)
    }
  }

  const handleSubmit = async (
    rating: EvaluationRating,
    correctAspects: string,
    needsAdjustment: string
  ) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/evaluations/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          conversationId,
          contentType,
          rating,
          correctAspects: correctAspects || undefined,
          needsAdjustment: needsAdjustment || undefined,
          messageContent: content,
          patientId: patientId || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to submit evaluation')
      }

      setSubmittedRating(rating)
      setIsModalOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit evaluation')
      setSelectedRating(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleModalSubmit = async (correctAspects: string, needsAdjustment: string) => {
    if (selectedRating) {
      await handleSubmit(selectedRating, correctAspects, needsAdjustment)
    }
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedRating(null)
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1">
        {RATINGS.map((rating) => {
          const isSelected = selectedRating === rating.value || submittedRating === rating.value
          const isDisabled = submittedRating !== null || isSubmitting

          return (
            <button
              key={rating.value}
              onClick={() => handleRatingClick(rating.value)}
              disabled={isDisabled}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border transition-all',
                isSelected
                  ? cn(rating.bgColor, rating.borderColor, rating.color, rating.activeBg)
                  : cn(
                      'bg-neutral-50 border-neutral-200 text-neutral-600',
                      !isDisabled && rating.hoverBg,
                      !isDisabled && 'hover:border-neutral-300'
                    ),
                isDisabled && !isSelected && 'opacity-50 cursor-not-allowed',
                submittedRating === rating.value && 'ring-2 ring-offset-1 ring-current'
              )}
              title={rating.label}
            >
              <HugeiconsIcon
                icon={rating.icon}
                size={12}
                color="currentColor"
              />
              <span className="hidden sm:inline">{rating.label}</span>
            </button>
          )
        })}
      </div>

      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}

      {submittedRating && (
        <p className="mt-1 text-xs text-green-600">Evaluation submitted</p>
      )}

      <EvalCommentModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        rating={selectedRating}
        onSubmit={handleModalSubmit}
        isSubmitting={isSubmitting}
      />
    </>
  )
}
