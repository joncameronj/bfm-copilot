'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { PatientAddNoteModal } from './PatientAddNoteModal'
import { StartConversationButton } from './StartConversationButton'
import { HugeiconsIcon } from '@hugeicons/react'
import { TestTube01Icon, FolderUploadIcon, NoteIcon } from '@hugeicons/core-free-icons'

interface PatientProfileActionsProps {
  patientId: string
  patientName: string
  patientAge: number
  patientGender: 'male' | 'female'
}

export function PatientProfileActions({
  patientId,
  patientName,
}: PatientProfileActionsProps) {
  const router = useRouter()
  const [showNoteModal, setShowNoteModal] = useState(false)

  const handleSuccess = () => {
    router.refresh()
  }

  return (
    <>
      <div className="flex gap-4 flex-wrap">
        <Button
          variant="secondary"
          onClick={() => setShowNoteModal(true)}
        >
          <HugeiconsIcon icon={NoteIcon} size={16} className="mr-2" />
          Add Note
        </Button>
        <Button
          variant="secondary"
          onClick={() => router.push(`/labs?patient=${patientId}`)}
        >
          <HugeiconsIcon icon={TestTube01Icon} size={16} className="mr-2" />
          Upload Labs
        </Button>
        <Button
          variant="secondary"
          onClick={() => router.push(`/diagnostics?patient=${patientId}`)}
        >
          <HugeiconsIcon icon={FolderUploadIcon} size={16} className="mr-2" />
          Upload Diagnostics
        </Button>
        <StartConversationButton patientId={patientId} />
        <Link href={`/patients/${patientId}/edit`}>
          <Button>Edit Patient</Button>
        </Link>
      </div>

      {/* Note Modal — no dedicated notes page, so modal is appropriate */}
      <PatientAddNoteModal
        isOpen={showNoteModal}
        onClose={() => setShowNoteModal(false)}
        patientId={patientId}
        patientName={patientName}
        onSuccess={handleSuccess}
      />
    </>
  )
}
