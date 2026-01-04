'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Copy01Icon, ThumbsUpIcon, ThumbsDownIcon, Tick01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

interface MessageActionsProps {
  messageId: string
  content: string
  conversationId: string
}

export function MessageActions({ messageId, content, conversationId }: MessageActionsProps) {
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  const [showFeedbackInput, setShowFeedbackInput] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleThumbsUp = async () => {
    if (feedback === 'up') return
    setFeedback('up')
    setShowFeedbackInput(false)

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          conversationId,
          feedbackType: 'chat_response',
          rating: 'positive',
        }),
      })
    } catch (err) {
      console.error('Failed to submit feedback:', err)
    }
  }

  const handleThumbsDown = () => {
    if (feedback === 'down') return
    setFeedback('down')
    setShowFeedbackInput(true)
  }

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) return
    setSubmitting(true)

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          conversationId,
          feedbackType: 'chat_response',
          rating: 'negative',
          comment: feedbackText.trim(),
          messageContent: content,
        }),
      })
      setShowFeedbackInput(false)
      setFeedbackText('')
    } catch (err) {
      console.error('Failed to submit feedback:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1">
        {/* Copy button */}
        <button
          onClick={handleCopy}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100'
          )}
          title="Copy to clipboard"
        >
          <HugeiconsIcon
            icon={copied ? Tick01Icon : Copy01Icon}
            size={16}
            color="currentColor"
          />
        </button>

        {/* Thumbs up */}
        <button
          onClick={handleThumbsUp}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            feedback === 'up'
              ? 'text-green-600 bg-green-50'
              : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100'
          )}
          title="Good response"
        >
          <HugeiconsIcon icon={ThumbsUpIcon} size={16} color="currentColor" />
        </button>

        {/* Thumbs down */}
        <button
          onClick={handleThumbsDown}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            feedback === 'down'
              ? 'text-red-600 bg-red-50'
              : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100'
          )}
          title="Bad response"
        >
          <HugeiconsIcon icon={ThumbsDownIcon} size={16} color="currentColor" />
        </button>
      </div>

      {/* Feedback input for thumbs down */}
      {showFeedbackInput && (
        <div className="mt-2 p-3 bg-neutral-50 rounded-lg">
          <p className="text-sm text-neutral-600 mb-2">
            What was wrong with this response?
          </p>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Please describe the issue..."
            className="w-full p-2 text-sm border border-neutral-200 rounded-lg resize-none focus:outline-none focus:border-neutral-300"
            rows={3}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => {
                setShowFeedbackInput(false)
                setFeedbackText('')
              }}
              className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitFeedback}
              disabled={!feedbackText.trim() || submitting}
              className="px-3 py-1.5 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
