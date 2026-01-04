'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { ProtocolRecommendation, FrequencyUsed, RecommendedFrequency } from '@/types/diagnostic-analysis'

interface ProtocolExecutionModalProps {
  recommendation: ProtocolRecommendation
  onClose: () => void
  onComplete: () => void
}

export function ProtocolExecutionModal({
  recommendation,
  onClose,
  onComplete,
}: ProtocolExecutionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [durationMinutes, setDurationMinutes] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [frequenciesUsed, setFrequenciesUsed] = useState<FrequencyUsed[]>(
    recommendation.recommendedFrequencies.map((f: RecommendedFrequency) => ({
      id: f.id,
      name: f.name,
      frequencyA: f.frequencyA,
      frequencyB: f.frequencyB,
    }))
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/protocol-recommendations/${recommendation.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frequenciesUsed,
          durationMinutes: durationMinutes ? parseInt(durationMinutes) : undefined,
          notes: notes || undefined,
        }),
      })

      if (res.ok) {
        onComplete()
      } else {
        const error = await res.json()
        console.error('Failed to execute protocol:', error)
      }
    } catch (error) {
      console.error('Failed to execute protocol:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Execute Protocol" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Protocol Info */}
        <div className="bg-neutral-50 rounded-xl p-4">
          <h3 className="font-medium text-neutral-900">{recommendation.title}</h3>
          {recommendation.description && (
            <p className="text-sm text-neutral-600 mt-1">{recommendation.description}</p>
          )}
        </div>

        {/* Frequencies */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            FSM Frequencies Used
          </label>
          <div className="space-y-2">
            {frequenciesUsed.map((freq, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-neutral-50 rounded-xl p-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={freq.name}
                    onChange={(e) => {
                      const updated = [...frequenciesUsed]
                      updated[idx] = { ...freq, name: e.target.value }
                      setFrequenciesUsed(updated)
                    }}
                    className="w-full text-sm font-medium text-neutral-900 bg-transparent border-none focus:outline-none"
                    placeholder="Frequency name"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={freq.frequencyA}
                    onChange={(e) => {
                      const updated = [...frequenciesUsed]
                      updated[idx] = { ...freq, frequencyA: parseFloat(e.target.value) || 0 }
                      setFrequenciesUsed(updated)
                    }}
                    className="w-16 text-sm text-right font-mono bg-white border border-neutral-200 rounded px-2 py-1"
                    placeholder="A"
                  />
                  <span className="text-neutral-400">/</span>
                  <input
                    type="number"
                    value={freq.frequencyB || ''}
                    onChange={(e) => {
                      const updated = [...frequenciesUsed]
                      updated[idx] = { ...freq, frequencyB: parseFloat(e.target.value) || undefined }
                      setFrequenciesUsed(updated)
                    }}
                    className="w-16 text-sm text-right font-mono bg-white border border-neutral-200 rounded px-2 py-1"
                    placeholder="B"
                  />
                  <span className="text-sm text-neutral-500">Hz</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Duration (minutes)
          </label>
          <Input
            type="number"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            placeholder="e.g., 30"
            min="1"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Session Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any observations during the session..."
            className="w-full px-4 py-3 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Mark as Executed
          </Button>
        </div>
      </form>
    </Modal>
  )
}
