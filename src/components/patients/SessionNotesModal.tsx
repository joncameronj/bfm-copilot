'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useTreatmentSessionMutations } from '@/hooks/useTreatmentSessions'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import type { TreatmentSessionWithDetails } from '@/types/treatment'
import { EFFECT_LABELS, EFFECT_BADGE_VARIANTS } from '@/types/treatment'
import Link from 'next/link'

interface SessionNotesModalProps {
  patientId: string
  session: TreatmentSessionWithDetails
  onClose: () => void
  onUpdate: () => void
}

export function SessionNotesModal({ patientId, session, onClose, onUpdate }: SessionNotesModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [notes, setNotes] = useState(session.notes || '')
  const { updateSession, isLoading } = useTreatmentSessionMutations()

  const handleSave = async () => {
    try {
      await updateSession(patientId, session.id, { notes })
      toast.success('Notes updated')
      onUpdate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update notes')
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Session Details"
      size="md"
    >
      <div className="space-y-6">
        {/* Session Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-neutral-400 mb-1">Date & Time</p>
            <p className="font-medium text-neutral-900">
              {formatDate(session.sessionDate)}
              {session.sessionTime && ` at ${session.sessionTime}`}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-1">Effect</p>
            <Badge variant={EFFECT_BADGE_VARIANTS[session.effect]}>
              {EFFECT_LABELS[session.effect]}
            </Badge>
          </div>
        </div>

        {/* Protocol */}
        {session.protocol && (
          <div>
            <p className="text-xs text-neutral-400 mb-1">Protocol</p>
            <Link
              href={`/protocols/${session.protocol.id}`}
              className="text-brand-blue hover:underline font-medium"
            >
              {session.protocol.title}
            </Link>
          </div>
        )}

        {/* Frequencies */}
        {session.frequenciesUsed.length > 0 && (
          <div>
            <p className="text-xs text-neutral-400 mb-2">Frequencies Used</p>
            <div className="flex flex-wrap gap-2">
              {session.frequenciesUsed.map((freq, i) => (
                <span
                  key={i}
                  className="text-sm bg-neutral-100 text-neutral-700 px-3 py-1 rounded-full"
                >
                  {freq.name}
                  <span className="text-neutral-500 ml-1">
                    ({freq.frequencyA}Hz{freq.frequencyB ? ` / ${freq.frequencyB}Hz` : ''})
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-neutral-400">Notes</p>
            {!isEditing && (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={6}
                placeholder="Add notes about this session..."
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false)
                    setNotes(session.notes || '')
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} isLoading={isLoading}>
                  Save Notes
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-neutral-50 rounded-lg p-4 min-h-[100px]">
              {session.notes ? (
                <p className="text-neutral-700 whitespace-pre-wrap">{session.notes}</p>
              ) : (
                <p className="text-neutral-400 italic">No notes recorded</p>
              )}
            </div>
          )}
        </div>

        {/* Timestamps */}
        <div className="pt-4 border-t border-neutral-200 text-xs text-neutral-400">
          <p>Created: {formatRelativeTime(session.createdAt)}</p>
          <p>Last updated: {formatRelativeTime(session.updatedAt)}</p>
        </div>

        {/* Close button */}
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
