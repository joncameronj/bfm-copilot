'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ThumbsUpIcon, ThumbsDownIcon } from '@hugeicons/core-free-icons'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface MessageFeedbackProps {
  messageId: string
  patientId?: string
}

export function MessageFeedback({ messageId, patientId }: MessageFeedbackProps) {
  const [submitted, setSubmitted] = useState(false)
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitFeedback = async (rating: 'positive' | 'negative', feedbackComment?: string) => {
    setIsSubmitting(true)

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          patientId,
          rating,
          comment: feedbackComment,
          feedbackType: 'response_quality',
        }),
      })
      setSubmitted(true)
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <span className="text-sm text-neutral-400">
        Thanks for your feedback
      </span>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-neutral-500">Helpful?</span>

      <button
        onClick={() => submitFeedback('positive')}
        disabled={isSubmitting}
        className="p-1.5 text-neutral-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
        title="Yes, this was helpful"
      >
        <HugeiconsIcon icon={ThumbsUpIcon} size={16} />
      </button>

      <button
        onClick={() => setShowComment(true)}
        disabled={isSubmitting}
        className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
        title="No, this wasn't helpful"
      >
        <HugeiconsIcon icon={ThumbsDownIcon} size={16} />
      </button>

      {showComment && (
        <div className="flex items-center gap-2 ml-2">
          <Input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What was wrong?"
            className="text-sm py-1.5 px-3 w-48"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => submitFeedback('negative', comment)}
            isLoading={isSubmitting}
          >
            Submit
          </Button>
        </div>
      )}
    </div>
  )
}
