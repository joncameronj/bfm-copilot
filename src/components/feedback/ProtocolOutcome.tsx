'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'

interface ProtocolOutcomeProps {
  patientId: string
  conversationId?: string
  onSubmit?: () => void
}

export function ProtocolOutcome({ patientId, conversationId, onSubmit }: ProtocolOutcomeProps) {
  const [outcome, setOutcome] = useState<'success' | 'partial' | 'no_improvement' | null>(null)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (!outcome) return

    setIsSubmitting(true)

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          feedbackType: 'protocol_outcome',
          rating: outcome === 'success' ? 'positive' : outcome === 'partial' ? 'neutral' : 'negative',
          outcome,
          comment,
        }),
      })
      setSubmitted(true)
      onSubmit?.()
    } catch (error) {
      console.error('Failed to submit outcome:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="bg-green-50 rounded-2xl p-6 text-center">
        <p className="text-green-700 font-medium">Thank you for your feedback!</p>
        <p className="text-green-600 text-sm mt-1">
          This helps improve protocol recommendations.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-neutral-50 rounded-2xl p-6">
      <h3 className="text-lg font-medium text-neutral-900 mb-4">
        Protocol Outcome
      </h3>
      <p className="text-neutral-500 text-sm mb-4">
        How effective was the recommended protocol for this patient?
      </p>

      {/* Outcome Selection */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <button
          onClick={() => setOutcome('success')}
          className={`
            p-4 rounded-xl text-center transition-colors
            ${outcome === 'success'
              ? 'bg-green-100 text-green-800 ring-2 ring-green-500'
              : 'bg-white hover:bg-neutral-100 text-neutral-700'
            }
          `}
        >
          <span className="text-2xl mb-1 block">&#10003;</span>
          <span className="font-medium">Success</span>
          <span className="text-xs block mt-1">
            Significant improvement
          </span>
        </button>

        <button
          onClick={() => setOutcome('partial')}
          className={`
            p-4 rounded-xl text-center transition-colors
            ${outcome === 'partial'
              ? 'bg-yellow-100 text-yellow-800 ring-2 ring-yellow-500'
              : 'bg-white hover:bg-neutral-100 text-neutral-700'
            }
          `}
        >
          <span className="text-2xl mb-1 block">&#8776;</span>
          <span className="font-medium">Partial</span>
          <span className="text-xs block mt-1">
            Some improvement
          </span>
        </button>

        <button
          onClick={() => setOutcome('no_improvement')}
          className={`
            p-4 rounded-xl text-center transition-colors
            ${outcome === 'no_improvement'
              ? 'bg-red-100 text-red-800 ring-2 ring-red-500'
              : 'bg-white hover:bg-neutral-100 text-neutral-700'
            }
          `}
        >
          <span className="text-2xl mb-1 block">&#10007;</span>
          <span className="font-medium">No Change</span>
          <span className="text-xs block mt-1">
            No improvement
          </span>
        </button>
      </div>

      {/* Comment */}
      <Textarea
        placeholder="Add any additional notes about the outcome (optional)..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        className="mb-4"
      />

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={!outcome}
        isLoading={isSubmitting}
        className="w-full"
      >
        Submit Outcome
      </Button>
    </div>
  )
}
