'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ThumbsUpIcon, ThumbsDownIcon, MinusSignIcon, Time01Icon } from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { ProtocolExecution, ExecutionOutcome } from '@/types/diagnostic-analysis'
import { cn } from '@/lib/utils'

interface ProtocolOutcomeModalProps {
  execution: ProtocolExecution
  protocolTitle: string
  onClose: () => void
  onComplete: () => void
}

const outcomeOptions: Array<{ value: ExecutionOutcome; label: string; icon: IconSvgElement; color: string }> = [
  { value: 'positive', label: 'Positive', icon: ThumbsUpIcon, color: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' },
  { value: 'neutral', label: 'Neutral', icon: MinusSignIcon, color: 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100' },
  { value: 'negative', label: 'Negative', icon: ThumbsDownIcon, color: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' },
  { value: 'pending', label: 'Need More Time', icon: Time01Icon, color: 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100' },
]

export function ProtocolOutcomeModal({
  execution,
  protocolTitle,
  onClose,
  onComplete,
}: ProtocolOutcomeModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedOutcome, setSelectedOutcome] = useState<ExecutionOutcome | null>(
    execution.outcome || null
  )
  const [outcomeNotes, setOutcomeNotes] = useState(execution.outcomeNotes || '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOutcome) return

    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/protocol-executions/${execution.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome: selectedOutcome,
          outcomeNotes: outcomeNotes || undefined,
        }),
      })

      if (res.ok) {
        onComplete()
      } else {
        const error = await res.json()
        console.error('Failed to record outcome:', error)
      }
    } catch (error) {
      console.error('Failed to record outcome:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Record Protocol Outcome" size="md">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Protocol Info */}
        <div className="bg-neutral-50 rounded-xl p-4">
          <h3 className="font-medium text-neutral-900">{protocolTitle}</h3>
          <p className="text-sm text-neutral-600 mt-1">
            Executed on {new Date(execution.executedAt).toLocaleDateString()}
          </p>
        </div>

        {/* Outcome Selection */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-3">
            How did the patient respond?
          </label>
          <div className="grid grid-cols-2 gap-3">
            {outcomeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedOutcome(option.value)}
                className={cn(
                  'flex items-center gap-3 p-4 rounded-xl border-2 transition-all',
                  selectedOutcome === option.value
                    ? 'ring-2 ring-offset-2 ring-neutral-900'
                    : '',
                  option.color
                )}
              >
                <HugeiconsIcon icon={option.icon} size={24} />
                <span className="font-medium">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Outcome Notes
          </label>
          <textarea
            value={outcomeNotes}
            onChange={(e) => setOutcomeNotes(e.target.value)}
            placeholder="Describe what happened, any changes observed..."
            className="w-full px-4 py-3 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
            rows={4}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isSubmitting}
            disabled={!selectedOutcome}
          >
            Record Outcome
          </Button>
        </div>
      </form>
    </Modal>
  )
}
