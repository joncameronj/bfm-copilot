'use client'

import { useState, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { HugeiconsIcon } from '@hugeicons/react'
import { FloppyDiskIcon, Cancel01Icon } from '@hugeicons/core-free-icons'
import toast from 'react-hot-toast'

interface PatientAddNoteModalProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName: string
  onSuccess?: () => void
}

export function PatientAddNoteModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  onSuccess,
}: PatientAddNoteModalProps) {
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = useCallback(async () => {
    if (!content.trim()) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/patients/${patientId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      })

      if (!response.ok) {
        throw new Error('Failed to save note')
      }

      toast.success('Note added successfully')
      setContent('')
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Save note error:', error)
      toast.error('Failed to save note')
    } finally {
      setIsSaving(false)
    }
  }, [content, patientId, onSuccess, onClose])

  const handleClose = () => {
    setContent('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Add Note for ${patientName}`} size="lg">
      <div className="space-y-6">
        {/* Note Input */}
        <div>
          <label htmlFor="note-content" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Note
          </label>
          <textarea
            id="note-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter your note here..."
            rows={6}
            className="w-full px-4 py-3 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent resize-none bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 placeholder-neutral-400 dark:placeholder-neutral-500"
            autoFocus
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <Button variant="secondary" onClick={handleClose} disabled={isSaving}>
            <HugeiconsIcon icon={Cancel01Icon} size={16} className="mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!content.trim() || isSaving}
            isLoading={isSaving}
          >
            <HugeiconsIcon icon={FloppyDiskIcon} size={16} className="mr-2" />
            Save Note
          </Button>
        </div>
      </div>
    </Modal>
  )
}
