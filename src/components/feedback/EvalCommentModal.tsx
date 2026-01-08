'use client'

import { useState, useEffect, useRef } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import type { EvaluationRating } from '@/types/eval-mode'
import { RATING_CONFIG } from '@/types/eval-mode'

interface EvalCommentModalProps {
  isOpen: boolean
  onClose: () => void
  rating: EvaluationRating | null
  onSubmit: (correctAspects: string, needsAdjustment: string) => Promise<void>
  isSubmitting: boolean
}

const MIN_COMMENT_LENGTH = 10

export function EvalCommentModal({
  isOpen,
  onClose,
  rating,
  onSubmit,
  isSubmitting,
}: EvalCommentModalProps) {
  const [correctAspects, setCorrectAspects] = useState('')
  const [needsAdjustment, setNeedsAdjustment] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const firstInputRef = useRef<HTMLTextAreaElement>(null)

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCorrectAspects('')
      setNeedsAdjustment('')
      setValidationError(null)
      // Focus first input after a short delay
      setTimeout(() => firstInputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSubmitting, onClose])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        !isSubmitting &&
        modalRef.current &&
        !modalRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, isSubmitting, onClose])

  const handleSubmit = async () => {
    // Validate at least one field has content
    const hasCorrectAspects = correctAspects.trim().length >= MIN_COMMENT_LENGTH
    const hasNeedsAdjustment = needsAdjustment.trim().length >= MIN_COMMENT_LENGTH

    if (!hasNeedsAdjustment) {
      setValidationError(
        `Please explain what needs adjustment (at least ${MIN_COMMENT_LENGTH} characters)`
      )
      return
    }

    setValidationError(null)
    await onSubmit(correctAspects.trim(), needsAdjustment.trim())
  }

  if (!isOpen || !rating) return null

  const ratingConfig = RATING_CONFIG[rating]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={modalRef}
        className="w-full max-w-lg mx-4 bg-white rounded-xl shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div>
            <h2 id="modal-title" className="text-lg font-semibold text-neutral-900">
              Evaluation Details
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-neutral-500">You selected:</span>
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded',
                  ratingConfig.bgColor,
                  ratingConfig.color,
                  ratingConfig.borderColor,
                  'border'
                )}
              >
                {ratingConfig.label}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={20} color="currentColor" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <div>
            <label
              htmlFor="correct-aspects"
              className="block text-sm font-medium text-neutral-700 mb-1"
            >
              Where is it correct? <span className="text-neutral-400">(optional)</span>
            </label>
            <textarea
              ref={firstInputRef}
              id="correct-aspects"
              value={correctAspects}
              onChange={(e) => setCorrectAspects(e.target.value)}
              placeholder="Describe what the response got right..."
              rows={3}
              disabled={isSubmitting}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-neutral-50"
            />
          </div>

          <div>
            <label
              htmlFor="needs-adjustment"
              className="block text-sm font-medium text-neutral-700 mb-1"
            >
              Where does it need adjustment? <span className="text-red-500">*</span>
            </label>
            <textarea
              id="needs-adjustment"
              value={needsAdjustment}
              onChange={(e) => {
                setNeedsAdjustment(e.target.value)
                setValidationError(null)
              }}
              placeholder="Describe what needs to be improved..."
              rows={3}
              disabled={isSubmitting}
              className={cn(
                'w-full px-3 py-2 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-neutral-50',
                validationError ? 'border-red-300' : 'border-neutral-200'
              )}
            />
            {validationError && (
              <p className="mt-1 text-xs text-red-600">{validationError}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-100 bg-neutral-50 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Evaluation'}
          </button>
        </div>
      </div>
    </div>
  )
}
